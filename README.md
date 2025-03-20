# Docs reorder plugin for Payload 3 (^3.28.1)

This plugin has most of the features (and code) of the original plugin by [r1tsuu](https://github.com/r1tsuu/payload-enchants), but with some improvements and made compatible with latest Payload version. (3.28.1)

## Install

`npm i @veiag/docs-reorder`

## About

Adds an option to re-order collection documents with drag n drop (almost like array/blocks items). Then on your front end you can query documents with applied sort by `docOrder` field.

## Video

https://github.com/user-attachments/assets/a47ab7a1-a58c-4626-aad3-9ca33788dbd8



In your payload.config.ts:

```ts
/// ....
import { docsReorder } from '@payload-enchants/docs-reorder';

export default buildConfig({
  // ...
  plugins: [
    docsReorder({
      collections: {
        posts: true, //Slug of the collection
      },
       // Needed to initialize values of docOrder field in collection documents. Only needed once per collection. (Run payload once with this option enabled , and more if you add new collection)
      initializeDocOrder: true,

      access: ({ req, data }) => {
        // Optional, configure access for `saveChanges` endpoint, default: Boolean(req.user)
        return req.user?.collection === 'admins';
      },
    }),
  ],
});
```

## Querying with applied plugin's sort.

REST:

```ts
fetch('http://localhost:3000/api/examples?sort=docOrder').then((res) => res.json());
```

Local API:

```ts
payload.find({ collection: 'examples', sort: 'docOrder' });
```

GraphQL:

```graphql
query {
  Examples(sort: "docOrder") {
    docs {
      title
    }
  }

```

Script to setup for collections that had documents before installing the plugin isn't needed anymore. The plugin will automatically initialize the `docOrder` field in documents of collections that have the plugin enabled with `initializeDocOrder: true` .s
