import { ApolloClient, InMemoryCache } from '@apollo/client/core/core.cjs'
import { SchemaLink } from '@apollo/client/link/schema/schema.cjs'
import { ApolloProvider } from '@apollo/client/react/react.cjs'
import { getDataFromTree } from '@apollo/client/react/ssr'
import { CacheProvider } from '@emotion/react'
import { configureStore } from '@reduxjs/toolkit'
import type { AppLoadContext, EntryContext } from '@remix-run/node'
import { RemixServer } from '@remix-run/react'
import createDebugger from 'debug'
import { isbot } from 'isbot'
import jwt from 'jsonwebtoken'
import { renderToStaticMarkup } from 'react-dom/server'
import { Helmet } from 'react-helmet'
import { Provider } from 'react-redux'
import { renderHeadToString } from 'remix-island'
import { reducer } from './api/client/state'
import createEmotionCache from './createEmotionCache'
import { Head } from './root'
import { Domain } from './server/graphql/Domain'
import { nullUser } from './server/graphql/modules/user/api/NullUser'
import schema from './server/graphql/schema'
// import { preloadRouteAssets } from 'remix-utils/preload-route-assets'

const debug = createDebugger('playnite-web/entry.server.tsx')
const ABORT_DELAY = 5_000

function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  loadContext: AppLoadContext,
) {
  return isbot(request.headers.get('user-agent'))
    ? handleBotRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext,
      )
    : handleBrowserRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext,
      )
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    const clientSideCache = createEmotionCache()
    const store = configureStore({ reducer })

    const client = new ApolloClient({
      ssrMode: true,
      cache: new InMemoryCache(),
      link: new SchemaLink({
        schema,
        context: {
          signingKey: process.env.SECRET ?? 'secret',
          domain: 'localhost',
          api: new Domain(process.env.SECRET ?? 'secret', 'localhost'),
        },
      }),
    })
    const App = (
      <ApolloProvider client={client}>
        <Provider store={store}>
          <RemixServer
            context={remixContext}
            url={request.url}
            abortDelay={ABORT_DELAY}
          />
        </Provider>
      </ApolloProvider>
    )

    return getDataFromTree(App).then(() => {
      // Extract the entirety of the Apollo Client cache's current state
      const initialState = client.extract()

      const renderedOutput = renderToStaticMarkup(
        <>
          <CacheProvider value={clientSideCache}>{App}</CacheProvider>
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__APOLLO_STATE__=${JSON.stringify(
                initialState,
              ).replace(/</g, '\\u003c')}`, // The replace call escapes the < character to prevent cross-site scripting attacks that are possible via the presence of </script> in a string literal
            }}
          />
        </>,
      )

      const head = renderHeadToString({ request, remixContext, Head })
      const helmet = Helmet.renderStatic()

      responseHeaders.set('Content-Type', 'text/html')
      resolve(
        new Response(
          `<!DOCTYPE html><html lang="en-US"><head>${head}${helmet.link.toString()}</head><body><div id="root">${renderedOutput}</div></body></html>`,
          {
            headers: responseHeaders,
            status: responseStatusCode,
          },
        ),
      )
    })
  })
}

async function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  return new Promise((resolve, reject) => {
    const clientSideCache = createEmotionCache()
    const store = configureStore({ reducer })
    let user = nullUser
    try {
      const value = decodeURIComponent(
        request.headers.get('Cookie')?.split('=')?.[1] ?? '',
      )
      const [type, token] = value.split(' ')
      if (type !== 'Bearer') {
        throw new Error('Invalid token')
      }
      user = jwt.decode(token, process.env.SECRET ?? 'secret', {
        issuer: 'http://localhost',
        algorithm: 'HS256',
      })
    } catch (error) {
      debug(error)
    }
    const client = new ApolloClient({
      ssrMode: true,
      cache: new InMemoryCache(),
      link: new SchemaLink({
        schema,
        context: {
          signingKey: process.env.SECRET ?? 'secret',
          domain: 'localhost',
          jwt: user,
          api: new Domain(process.env.SECRET ?? 'secret', 'localhost'),
        },
      }),
    })
    const App = (
      <ApolloProvider client={client}>
        <Provider store={store}>
          <RemixServer
            context={remixContext}
            url={request.url}
            abortDelay={ABORT_DELAY}
          />
        </Provider>
      </ApolloProvider>
    )

    return getDataFromTree(App).then(() => {
      // Extract the entirety of the Apollo Client cache's current state
      const initialState = client.extract()

      const renderedOutput = renderToStaticMarkup(
        <>
          <CacheProvider value={clientSideCache}>{App}</CacheProvider>
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__APOLLO_STATE__=${JSON.stringify(
                initialState,
              ).replace(/</g, '\\u003c')}`, // The replace call escapes the < character to prevent cross-site scripting attacks that are possible via the presence of </script> in a string literal
            }}
          />
        </>,
      )

      const head = renderHeadToString({ request, remixContext, Head })
      const helmet = Helmet.renderStatic()

      responseHeaders.set('Content-Type', 'text/html')
      resolve(
        new Response(
          `<!DOCTYPE html><html lang="en-US"><head>${head}${helmet.link.toString()}</head><body><div id="root">${renderedOutput}</div></body></html>`,
          {
            headers: responseHeaders,
            status: responseStatusCode,
          },
        ),
      )
    })
  })
}

export default handleRequest
