# An example to try amqp10-converter

## Description
This is a demonstration that amqp10-converter bridges between AMQP1.0 Broker(Apache ActiveMQ Artemis) and FIWARE IoTAgent JSON.

```
+--------------+  attrs   +--------------------+  attrs   +--------------------+  attrs   +-----------------+      +----------------------+
|              +---------->                    +---------->                    +---------->                 |      |                      |
|              |   cmd    |  AMQP1.0 Broker    |   cmd    |                    |   cmd    |                 +------>                      |
| dummy client <----------+                    <----------+  amqp10-converter  <----------+  IoTAgent JSON  |      | Orion Context Broker |
|              |  cmdexe  | (ActiveMQ Artemis) |  cmdexe  |                    |  cmdexe  |                 <------+                      |
|              +---------->                    +---------->                    +---------->                 |      |                      |
+--------------+          +--------------------+          +--------------------+          +---------------+-+      +-+--------------------+
                 AMQP 1.0                        AMQP 1.0                          HTTP                   |   NGSI   |
                                                                                                          |          |
                                                                                                        +-+----------+-+
                                                                                                        |              |
                                                                                                        |   Mongo DB   |
                                                                                                        |              |
                                                                                                        +--------------+
```

## How to use
1. go to the `example` directory.

    ```
    $ cd example/
    ```
1. create a container of the dummy client.

    ```
    $ docker build -t my/dummy-client:0.1.0 ./dummy_client
    ```
1. start "ActiveMQ Artemis" and "Mongo DB".

    ```
    $ docker-compose -f docker-compose-base.yml up
    ```
1. wait until "ActiveMQ Artemis" starts, and create an Upstream Queue and a Downstream Queue corresponding to the dummy client Entity.

    ```
    $ ./scripts/activemq/create_queue.sh
    ```
1. start "Orion Context Broker", "IoTAgent JSON" and "amqp10-converter".

    ```
    $ docker-compose up
    ```
1. wait until All containers start successfully.
1. register a service and a device corresponding to the dummy client.

    ```
    $ ./scripts/iotagent/create_servcie_device.sh
    ```
1. retrieve the NGSIv2 Entity corresponding to the dummy client.

    ```
    $ curl -sS -H "fiware-service: demoservice" -H "fiware-servicepath: /demo/path" http://localhost:1026/v2/entities/robot01 | python -mjson.tool
    ```
    ```json
    {
        "TimeInstant": {
            "metadata": {},
            "type": "DateTime",
            "value": "2020-06-02T00:12:20.00Z"
        },
        "id": "robot01",
        "open": {
            "metadata": {},
            "type": "command",
            "value": ""
        },
        "open_info": {
            "metadata": {},
            "type": "commandResult",
            "value": " "
        },
        "open_status": {
            "metadata": {},
            "type": "commandStatus",
            "value": "UNKNOWN"
        },
        "temperature": {
            "metadata": {},
            "type": "number",
            "value": " "
        },
        "type": "robot"
    }
    ```
1. send `temperature` from dummy client to "ActiveMQ Artemis".

    ```
    $ docker run --env-file .env.client nmatsui/dummy-client:0.1.0 attrs
    ```
    ```
    msg { body: '{"attrs":{"temperature":21.934956619788522}}' }
    [connection-1] await sendMessage -> Delivery id: 0, settled: true
    sent attributes successfully
    ```
1. the `temperature` attribute will be updated automatically by "amqp10-converter" and "IoTAgent JSON".

    ```
    $ curl -sS -H "fiware-service: demoservice" -H "fiware-servicepath: /demo/path" http://localhost:1026/v2/entities/robot01/?attrs=temperature | python -mjson.tool
    ```
    ```json
    {
        "id": "robot01",
        "temperature": {
            "metadata": {
                "TimeInstant": {
                    "type": "DateTime",
                    "value": "2020-06-02T03:19:07.00Z"
                }
            },
            "type": "number",
            "value": 21.93495662
        },
        "type": "robot"
    }
    ```
1. send `open` command to "Orion Context Broker".

    ```
    $ ./scripts/iotagent/send_cmd.sh
    ```
1. the status of `open` command will be updated as 'PENDING' automatically and a new `cmd` message will be produced to "ActiveMQ Artemis".

    ```
    $ curl -sS -H "fiware-service: demoservice" -H "fiware-servicepath: /demo/path" http://localhost:1026/v2/entities/robot01/?attrs=open_status,open_info | python -mjson.tool
    ```
    ```json
    {
        "id": "robot01",
        "open_info": {
            "metadata": {},
            "type": "commandResult",
            "value": " "
        },
        "open_status": {
            "metadata": {
                "TimeInstant": {
                    "type": "DateTime",
                    "value": "2020-06-02T03:19:23.00Z"
                }
            },
            "type": "commandStatus",
            "value": "PENDING"
        },
        "type": "robot"
    }
    ```
1. consume the `cmd` message from "ActiveMQ Artemis" and produce the `cmdexe` message to "ActiveMQ Artemis".

    ```
    $ docker run --env-file .env.client nmatsui/dummy-client:0.1.0 cmd
    ```
    ```
    start consuming cmd
    msg { body: '{"cmdexe":{"open":"processed window1"}}' }
    [connection-1] await sendMessage -> Delivery id: 0, settled: true
    ```
1. the status of `open` command will be updated as 'OK' automatically.

    ```
    $ curl -sS -H "fiware-service: demoservice" -H "fiware-servicepath: /demo/path" http://localhost:1026/v2/entities/robot01/?attrs=open_status,open_info | python -mjson.tool
    ```
    ```json
    {
        "id": "robot01",
        "open_info": {
            "metadata": {
                "TimeInstant": {
                    "type": "DateTime",
                    "value": "2020-06-02T03:20:09.00Z"
                }
            },
            "type": "commandResult",
            "value": "processed window1"
        },
        "open_status": {
            "metadata": {
                "TimeInstant": {
                    "type": "DateTime",
                    "value": "2020-06-02T03:20:09.00Z"
                }
            },
            "type": "commandStatus",
            "value": "OK"
        },
        "type": "robot"
    }
    ```
