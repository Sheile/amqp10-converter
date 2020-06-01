#!/bin/bash

export FIWARE_SERVICE="demoservice"
export FIWARE_SERVICEPATH="/demo/path"
export type=robot
export id=robot01

# send command to device
curl -i "http://localhost:1026/v2/entities/${id}/attrs?type=${type}" \
     -H "Fiware-Service: ${FIWARE_SERVICE}" \
     -H "Fiware-ServicePath: ${FIWARE_SERVICEPATH}" \
     -H "Content-Type: application/json" \
     -X PATCH -d @- <<__EOS__
{
  "open": {
    "value": "window1"
  }
}
__EOS__
