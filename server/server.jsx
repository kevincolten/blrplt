import 'babel-polyfill';
import path from 'path';

import React from 'react';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { createServerRenderContext } from 'react-router';

require('es6-promise').polyfill();
require('isomorphic-fetch');

import configureStore from '../client/store';
import { Html } from '../client/components';
import App from '../client/app';
import rootSaga from '../client/sagas';

const serverless = process.env.SERVERLESS;

let awsServerlessExpressMiddleware;
if (serverless) {
  awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
}

const manifest = require('../build/manifest.json');

const renderHTML = (markup, store) => {
  const html = renderToStaticMarkup(
    <Html markup={markup} manifest={manifest} store={store} />
  );
  return `${html}`;
};

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

if (awsServerlessExpressMiddleware) {
  app.use(awsServerlessExpressMiddleware.eventContext());
}

app.use('/public', express.static(path.join(__dirname, '/public')));

app.get('*', (req, res) => {
  const store = configureStore();
  const context = createServerRenderContext();

  const rootComp = (
    <App
      location={req.originalUrl}
      context={context}
      store={store}
      type="server"
    />
  );

  store.runSaga(rootSaga).done.then(() => {
    const markup = renderToString(rootComp);
    const html = renderHTML(markup, store);

    const result = context.getResult();
    if (result.redirect) {
      res.redirect(302, result.redirect.pathname);
    } else if (result.missed) {
      res.status(404).send(html);
    } else {
      res.status(200).send(html);
    }
  });

  store.close();
});

if (!serverless) {
  console.log('listening on port 3000');
  app.listen(3000);
}

export default app;
