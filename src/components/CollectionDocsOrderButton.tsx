'use client'
import type { BeforeListClientProps, PaginatedDocs } from 'payload'

import {
  Button,
  DragHandleIcon,
  Modal,
  toast,
  useConfig,
  useLocale,
  useModal,
  useTranslation,
  XIcon,
} from '@payloadcms/ui'
import { DraggableSortable } from '@payloadcms/ui/elements/DraggableSortable'
import { DraggableSortableItem } from '@payloadcms/ui/elements/DraggableSortable/DraggableSortableItem'
import { Radio } from '@payloadcms/ui/fields/RadioGroup/Radio'
import React, { useCallback, useEffect, useState } from 'react'

import './styles.scss'
import { saveChanges } from '../handlers/saveChanges.client.js'

type Doc = {
  docOrder: number
  id: number | string
  modifiedFrom?: number
  modifiedTo?: number
} & Record<string, unknown>

const CollectionDocsOrderContent = ({ collectionSlug }: { collectionSlug: string }) => {
  const { config } = useConfig()
  const { t } = useTranslation()

  const { code: locale } = useLocale()

  const limit = 25

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const [data, setData] = useState<{
    docs: Doc[]
    hasNextPage: boolean
    isLoading: boolean
    loadedPages: number
    totalDocs: number
  }>({
    docs: [],
    hasNextPage: false,
    isLoading: true,
    loadedPages: 0,
    totalDocs: 0,
  })

  const hasSave = data.docs.some(
    (doc) => typeof doc?.modifiedTo === 'number' && doc.modifiedTo !== doc.docOrder,
  )

  const sort = `sort=${sortOrder === 'desc' ? '-' : ''}docOrder`

  const getInitalData = useCallback(async () => {
    const res = await fetch(
      `/api/${collectionSlug}?${sort}&limit=${limit}${locale ? `&locale=${locale}` : ''}&depth=0`,
    )

    const { docs, hasNextPage, totalDocs } = await res.json()

    return setData({
      docs,
      hasNextPage,
      isLoading: false,
      loadedPages: 1,
      totalDocs,
    })
  }, [collectionSlug, locale, sort])

  useEffect(() => {
    if (collectionSlug) {
      void getInitalData()
    }
  }, [getInitalData, collectionSlug])

  const collectionConfig = config.collections.find(
    (collection) => collection.slug === collectionSlug,
  )

  if (!collectionConfig) {
    return null
  }

  const useAsTitle = collectionConfig.admin.useAsTitle

  const moveRow = (moveFromIndex: number, moveToIndex: number) => {
    setData((prev) => {
      const prevDocs = [...prev.docs]

      const newDocs = [...prev.docs]

      const [movedItem] = newDocs.splice(moveFromIndex, 1)

      newDocs.splice(moveToIndex, 0, movedItem)

      return {
        ...prev,
        docs: newDocs.map((doc, index) => {
          if (!doc) {
            return doc
          }
          if (prevDocs[index]?.id !== doc.id) {
            return {
              ...doc,
              modifiedTo: prevDocs[index]?.modifiedTo ?? prevDocs[index]?.docOrder,
            }
          }

          return doc
        }),
      }
    })
  }

  type TArg = Parameters<typeof t>[0]

  const save = async () => {
    const modifiedDocsData = data.docs
      .filter((doc) => typeof doc.modifiedTo === 'number' && doc.modifiedTo !== doc.docOrder)
      .map((doc) => ({
        id: doc.id,
        modifiedTo: doc.modifiedTo,
      }))

    if (!collectionSlug || !modifiedDocsData) {
      return
    }

    const { success } = await saveChanges({
      api: `${config.serverURL}${config.routes.api}`,
      args: {
        collection: collectionSlug,
        docs: modifiedDocsData as { id: number | string; modifiedTo: number }[],
      },
    })

    if (success) {
      setData((prev) => ({ ...prev, isLoading: true }))
      //wait 500 ms to let the server update orderField ( idk why it's not updated on getInitialData , but waiting 500ms works for now )
      await new Promise((resolve) => setTimeout(resolve, 500))

      await getInitalData()
      toast.success(t('pluginCollectionsDocsOrder:success' as TArg), {
        position: 'bottom-center',
      })
    } else {
      toast.error(t('pluginCollectionsDocsOrder:error' as TArg), {
        position: 'bottom-center',
      })
    }
  }

  const loadMore = () => {
    setData((prev) => ({ ...prev, isLoading: true }))

    return fetch(
      `${config.serverURL}${config.routes.api}/${collectionSlug}?${sort}&limit=${limit}&page=${data.loadedPages + 1}&depth=0&locale=${locale}`,
    )
      .then((res) => res.json())
      .then(({ docs, hasNextPage }: PaginatedDocs<Doc>) =>
        setData((prev) => ({
          docs: [...prev.docs, ...docs],
          hasNextPage,
          isLoading: false,
          loadedPages: prev.loadedPages + 1,
          totalDocs: prev.totalDocs,
        })),
      )
  }

  const handleSortOrderChange = (order: 'asc' | 'desc') => {
    setSortOrder(order)
    setData((prev) => ({ ...prev, isLoading: true }))
  }

  return (
    <div className="collection-docs-order-content">
      <div className="order-buttons">
        <Button
          onClick={() => handleSortOrderChange('asc')}
          buttonStyle={sortOrder === 'asc' ? 'primary' : 'secondary'}
        >
          {t('pluginCollectionsDocsOrder:asc' as TArg)}
        </Button>
        <Button
          onClick={() => handleSortOrderChange('desc')}
          buttonStyle={sortOrder === 'desc' ? 'primary' : 'secondary'}
        >
          {t('pluginCollectionsDocsOrder:desc' as TArg)}
        </Button>
      </div>
      <DraggableSortable
        className="order-list"
        ids={data.docs.map((doc) => String(doc.id))}
        onDragEnd={({ moveFromIndex, moveToIndex }) => moveRow(moveFromIndex, moveToIndex)}
      >
        {data.docs.map((doc) => (
          <DraggableSortableItem disabled={false} id={String(doc.id)} key={doc.id}>
            {(props) => {
              return (
                <div
                  className="order-item"
                  ref={props.setNodeRef}
                  style={{ transform: props.transform }}
                >
                  <div
                    {...props.attributes}
                    {...props.listeners}
                    className="order-drag"
                    role="button"
                  >
                    <DragHandleIcon />
                  </div>
                  <a href={`/admin/collections/${collectionSlug}/${doc.id}`} target="_blank">
                    {doc.docOrder}
                    {typeof doc.modifiedTo === 'number' &&
                      doc.modifiedTo !== doc.docOrder &&
                      ` - ${doc.modifiedTo}`}
                    {' - '}
                    {doc[useAsTitle] as string}
                  </a>
                </div>
              )
            }}
          </DraggableSortableItem>
        ))}
      </DraggableSortable>
      <div className="order-buttons">
        {data.isLoading
          ? 'Loading'
          : `${t('pluginCollectionsDocsOrder:loaded' as TArg)} ${data.docs.length}/${data.totalDocs}`}
        {hasSave && (
          <Button onClick={() => save()}>{t('pluginCollectionsDocsOrder:save' as TArg)}</Button>
        )}
        {hasSave && (
          <Button onClick={() => getInitalData()} buttonStyle="pill">
            {t('pluginCollectionsDocsOrder:cancel' as TArg)}
          </Button>
        )}
        {data.hasNextPage && (
          <Button onClick={loadMore}>{t('pluginCollectionsDocsOrder:loadMore' as TArg)}</Button>
        )}
      </div>
    </div>
  )
}

export const CollectionDocsOrderButton: React.FC<BeforeListClientProps> = ({ collectionSlug }) => {
  const { t } = useTranslation()

  type TArg = Parameters<typeof t>[0]

  const { toggleModal } = useModal()

  return (
    <div className="gutter--left gutter--right collection-docs-order">
      <Button onClick={() => toggleModal('CollectionDocsOrderContent')}>
        {t('pluginCollectionsDocsOrder:sortItems' as TArg)}
      </Button>
      <Modal className="dialog-wrapper" slug="CollectionDocsOrderContent">
        <div className={'dialog-content'}>
          <CollectionDocsOrderContent collectionSlug={collectionSlug} />
          <Button className="close" onClick={() => toggleModal('CollectionDocsOrderContent')}>
            <XIcon />
          </Button>
        </div>
      </Modal>
    </div>
  )
}
