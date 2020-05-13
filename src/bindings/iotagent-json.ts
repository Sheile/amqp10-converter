import axios from 'axios';
import { Entity, JsonType } from '@/common';

const iotagentHost = process.env.IOTA_HOST || 'localhost';
const iotagentPort = parseInt(process.env.IOTA_PORT || '7896');
const fiwareService = process.env.FIWARE_SERVICE || '';
const fiwareServicePath = process.env.FIWARE_SERVICEPATH || '/';

export const sendAttributes = async (entity: Entity, data?: JsonType | undefined): Promise<number> => {
  const url = `http://${iotagentHost}:${iotagentPort}/iot/json?k=${entity.type}&i=${entity.id}`;
  const headers = {
    "Fiware-Service": fiwareService,
    "Fiware-ServicePath": fiwareServicePath,
    "Content-Type": "application/json",
  };
  const response = await axios.post(url, data, {headers: headers});
  return response.status;
};