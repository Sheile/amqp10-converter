import express from 'express';
import { notFoundHandler, defaultContentTypeMiddleware } from '@/routes/handlers';
import request from "supertest";

describe('routes/handlers', () => {
  describe('notFoundHandler', () => {
    describe.each([
      ['/'],
      ['/dummy'],
    ])('', (path) => {
      it.each([
        ['get'],
        ['post'],
        ['put'],
        ['patch'],
        ['delete'],
      ])(`responds status code 404 to %s "${path}"`, async (method) => {
        const app = express();
        app.use(notFoundHandler);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (request(app) as any)[method](path);
        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({ statusCode: 404, cause: 'path not found', path: path });
      });
    });
  });

  describe('defaultContentTypeMiddleware', () => {
    describe.each([
      [null],
      [''],
      ['application/x-www-form-urlencoded'],
      ['multipart/form-data'],
    ])('', (contentType) => {
      const desc = contentType ?
        `passes the "Content-Type: ${contentType}" without any changing when %s request contains "Content-Type"` :
        `adds "Content-Type: application/json" when %s request does not contain "Content-Type"`;
      it.each([
        ['get'],
        ['post'],
        ['put'],
        ['patch'],
        ['delete'],
      ])(desc, async (method) => {
        const path = '/test';
        const app = express();
        app.use(defaultContentTypeMiddleware);
        app.use(express.json());
        app.use(path, (req, res) => {
          expect(req.headers['content-type']).toBe(contentType ? contentType : 'application/json');
          res.status(200).json({ result: 'OK'});
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = (request(app) as any)[method](path)
        if (contentType !== null) {
          r.set('content-type', contentType);
        }
        const response = await r;
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({result: 'OK'});
      });
    });
  });
});