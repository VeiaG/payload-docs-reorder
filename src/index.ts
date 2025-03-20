import type { CollectionSlug, Config, PayloadRequest } from 'payload'

import { deepMerge } from 'payload/shared'

import { defaultAccess } from './defaultAccess.js'
import { saveChanges } from './handlers/saveChanges.js'
import { incrementOrder } from './hooks/incrementOrder.js'
import { translations } from './translations/index.js'
import { SaveChangesArgs } from './handlers/types.js'

export type DocsReorderConfig = {
  access?: (args: { data: SaveChangesArgs; req: PayloadRequest }) => boolean | Promise<boolean>
  /**
   * List of collections to add doc reordering to
   */
  collections?: Partial<Record<CollectionSlug, true>>
  disabled?: boolean

  /**
   * Initialize docOrder field for existing docs as index of the doc in the collection ( based on createdAt field).
   * Rerun payload , if you add new collections.
   */
  initializeDocOrder?: boolean
}

export const docsReorder =
  (pluginOptions: DocsReorderConfig) =>
  (config: Config): Config => {
    if (!config.collections) {
      config.collections = []
    }

    if (pluginOptions.collections) {
      for (const collectionSlug in pluginOptions.collections) {
        const collection = config.collections.find(
          (collection) => collection.slug === collectionSlug,
        )

        if (collection) {
          collection.fields.push({
            name: 'docOrder',
            type: 'number',
            access: {
              create: () => false,
              read: () => true,
              update: () => false,
            },
            admin: {
              hidden: true,
            },
            index: true,
          })
          if (pluginOptions.disabled) {
            // if plugin is disabled, don't add hooks and reorder button
            continue
          }
          //hook for newly created doc
          collection.hooks = {
            ...collection.hooks,
            beforeValidate: [...(collection.hooks?.beforeValidate || []), incrementOrder],
          }
          //reoder button
          if (!collection.admin) {
            collection.admin = {}
          }
          if (!collection.admin.components) {
            collection.admin.components = {}
          }
          if (!collection.admin.components.beforeList) {
            collection.admin.components.beforeList = []
          }
          collection.admin.components.beforeList.push(
            `@veiag/docs-reorder/client#CollectionDocsOrderButton`,
          )
        }
      }
    }

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     * If your plugin heavily modifies the database schema, you may want to remove this property.
     */
    if (pluginOptions.disabled) {
      return config
    }

    if (!config.i18n) {
      config.i18n = {}
    }
    config.i18n.translations = {
      ...deepMerge(translations, config.i18n?.translations ?? {}),
    }

    if (!config.endpoints) {
      config.endpoints = []
    }

    if (!config.admin) {
      config.admin = {}
    }

    if (!config.admin.components) {
      config.admin.components = {}
    }

    if (!config.admin.components.beforeDashboard) {
      config.admin.components.beforeDashboard = []
    }

    config.endpoints.push({
      handler: saveChanges({
        access: pluginOptions.access ?? defaultAccess,
      }),
      method: 'post',
      path: '/collection-docs-order/save',
    })

    const incomingOnInit = config.onInit

    config.onInit = async (payload) => {
      // Ensure we are executing any existing onInit functions before running our own.
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }
      if (!pluginOptions.initializeDocOrder) {
        return
      }
      // Initialize doc order field (if it doesn't exist)
      if (pluginOptions.collections) {
        for (const collectionSlug in pluginOptions.collections) {
          const collection = config.collections?.find(
            (collection) => collection.slug === collectionSlug,
          )

          if (collection) {
            // if collection docOrder field is empty, initialize it as index
            const collectionDocs = await payload.find({
              collection: collectionSlug,
              depth: 1,
              limit: 0,
              pagination: false,
              sort: '-createdAt',
            })
            //if collectionDocs.docs have docOrder field ,return
            if (collectionDocs.docs.some((doc) => doc?.docOrder !== undefined)) {
              return
            }

            for (const doc of collectionDocs.docs) {
              if (!doc.docOrder) {
                const index = collectionDocs.docs.indexOf(doc)
                await payload.update({
                  id: doc.id,
                  collection: collectionSlug,

                  data: {
                    docOrder: index,
                  },
                })
              }
            }
          }
        }
      }
    }

    return config
  }
