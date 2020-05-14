import {Request, Response, NextFunction} from 'express';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ statusCode: 404, cause: 'path not found', path: req.path });
};

export const defaultContentTypeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.headers['content-type'] = req.headers['content-type'] || 'application/json';
  next();
}