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
1. check the status of created queues.

    ```
    $ ./scripts/activemq/stat_queue.sh
    ```
    ```text
    Connection brokerURL = tcp://localhost:61616
    |NAME                     |ADDRESS                  |CONSUMER_COUNT |MESSAGE_COUNT |MESSAGES_ADDED |DELIVERING_COUNT |MESSAGES_ACKED |SCHEDULED_COUNT |ROUTING_TYPE |
    |robot.robot01.down       |robot.robot01.down       |0              |0             |0              |0                |0              |0               |ANYCAST      |
    |robot.robot01.up         |robot.robot01.up         |0              |0             |0              |0                |0              |0               |ANYCAST      |
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
            "value": "2020-09-06T04:46:32.00Z"
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
    $ docker run --env-file .env.client my/dummy-client:0.1.0 attrs
    ```
    ```text
    msg { body: '{"attrs":{"temperature":31.241109372105107}}' }
    [connection-1] await sendMessage -> Delivery id: 0, settled: true
    sent attributes successfully
    ```
    * after the above messages are shown, press Ctrl-C to stop dummy client.
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
                    "value": "2020-09-06T04:46:48.00Z"
                }
            },
            "type": "number",
            "value": 31.241109372
        },
        "type": "robot"
    }
    ```
1. confirm the `robot.robot01.up` queue that `MESSAGE_COUNT == 0`, `MESSAGES_ADDED += 1 (== 1)` and `MESSAGES_ACKED += 1 (== 1)`.

    ```
    $ ./scripts/activemq/stat_queue.sh
    ```
    ```text
    Connection brokerURL = tcp://localhost:61616
    |NAME                     |ADDRESS                  |CONSUMER_COUNT |MESSAGE_COUNT |MESSAGES_ADDED |DELIVERING_COUNT |MESSAGES_ACKED |SCHEDULED_COUNT |ROUTING_TYPE |
    |robot.robot01.down       |robot.robot01.down       |0              |0             |0              |0                |0              |0               |ANYCAST      |
    |robot.robot01.up         |robot.robot01.up         |1              |0             |1              |0                |1              |0               |ANYCAST      |
    ```
1. confirm the log of `amqp10-converter` that "sent atributes:" DEBUG message is shown.

    ```
    $ docker logs example_amqp10-converter_1
    ```
    ```text
    ...
    2020-09-06T04:46:48.577-0000 [DEBUG] amqp10 - received message: {"attrs":{"temperature":31.241109372105107}}
    2020-09-06T04:46:48.577-0000 [DEBUG] amqp10 - converted message: {"attrs":{"temperature":31.241109372105107}}
    2020-09-06T04:46:48.623-0000 [DEBUG] amqp10 - sent attributes: { temperature: 31.241109372105107 }
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
                    "value": "2020-09-06T04:50:03.00Z"
                }
            },
            "type": "commandStatus",
            "value": "PENDING"
        },
        "type": "robot"
    }
    ```
1. confirm the `robot.robot01.down` queue that `MESSAGE_COUNT += 1 (== 1)`, `MESSAGES_ADDED += 1 (== 1)` and `MESSAGES_ACKED == 0`.

    ```
    $ ./scripts/activemq/stat_queue.sh
    ```
    ```text
    Connection brokerURL = tcp://localhost:61616
    |NAME                     |ADDRESS                  |CONSUMER_COUNT |MESSAGE_COUNT |MESSAGES_ADDED |DELIVERING_COUNT |MESSAGES_ACKED |SCHEDULED_COUNT |ROUTING_TYPE |
    |robot.robot01.down       |robot.robot01.down       |0              |1             |1              |0                |0              |0               |ANYCAST      |
    |robot.robot01.up         |robot.robot01.up         |1              |0             |1              |0                |1              |0               |ANYCAST      |
    ```
1. confirm the log of `amqp10-converter` that "sent cmd to AMQP Server:" DEBUG message is shown.

    ```
    $ docker logs example_amqp10-converter_1
    ```
    ```text
    ...
    2020-09-06T04:50:03.725-0000 [DEBUG] cmd - post /cmd/:type/:id { type: 'robot', id: 'robot01' } { open: 'window1' }
    2020-09-06T04:50:03.742-0000 [DEBUG] amqp10 - sent message to device: { body: '{"cmd":{"open":"window1"}}' }
    2020-09-06T04:50:03.745-0000 [DEBUG] cmd - sent cmd to AMQP Server, cmd: {"open":"window1"}, delivered id: 0
    ```
1. consume the `cmd` message from "ActiveMQ Artemis" and produce the `cmdexe` message to "ActiveMQ Artemis".

    ```
    $ docker run --env-file .env.client my/dummy-client:0.1.0 cmd
    ```
    ```text
    start consuming cmd
    msg { body: '{"cmdexe":{"open":"processed window1"}}' }
    [connection-2] await sendMessage -> Delivery id: 0, settled: true
    ```
    * after the above messages are shown, press Ctrl-C to stop dummy client.
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
                    "value": "2020-09-06T04:51:42.00Z"
                }
            },
            "type": "commandResult",
            "value": "processed window1"
        },
        "open_status": {
            "metadata": {
                "TimeInstant": {
                    "type": "DateTime",
                    "value": "2020-09-06T04:51:42.00Z"
                }
            },
            "type": "commandStatus",
            "value": "OK"
        },
        "type": "robot"
    }
    ```
1. confirm `robot.robot01.down` queue that `MESSAGE_COUNT -= 1 (== 0)`, `MESSAGES_ADDED += 0 (== 1)` and `MESSAGES_ACKED += 1 (== 1)`, and confirm `robot.robot01.up` queue that `MESSAGE_COUNT == 0`, `MESSAGES_ADDED += 1 (== 2)` and `MESSAGES_ACKED += 1 (== 2)`.

    ```
    $ ./scripts/activemq/stat_queue.sh
    ```
    ```text
    Connection brokerURL = tcp://localhost:61616
    |NAME                     |ADDRESS                  |CONSUMER_COUNT |MESSAGE_COUNT |MESSAGES_ADDED |DELIVERING_COUNT |MESSAGES_ACKED |SCHEDULED_COUNT |ROUTING_TYPE |
    |robot.robot01.down       |robot.robot01.down       |0              |0             |1              |0                |1              |0               |ANYCAST      |
    |robot.robot01.up         |robot.robot01.up         |1              |0             |2              |0                |2              |0               |ANYCAST      |
    ```
1. confirm the log of `amqp10-converter` that "called setCommandResult successfully" DEBUG message is shown.

    ```
    $ docker logs example_amqp10-converter_1
    ```
    ```text
    ...
    2020-09-06T04:51:42.211-0000 [DEBUG] amqp10 - received message: {"cmdexe":{"open":"processed window1"}}
    2020-09-06T04:51:42.211-0000 [DEBUG] amqp10 - converted message: {"cmdexe":{"open":"processed window1"}}
    2020-09-06T04:51:42.233-0000 [DEBUG] amqp10 - sent command result: { open: 'processed window1' }
    2020-09-06T04:51:42.240-0000 [DEBUG] iotagent-lib - called setCommandResult successfully
    ```
1. send `dummy data` from dummy client to "ActiveMQ Artemis" in order to confirm the message validation.

    ```
    $ docker run --env-file .env.client my/dummy-client:0.1.0 dummy
    ```
    ```text
    msg { body: '{"dummy":"dummy"}' }
    [connection-1] await sendMessage -> Delivery id: 0, settled: true
    sent dummy data successfully
    ```
    * after the above messages are shown, press Ctrl-C to stop dummy client.
1. make sure the `robot.robot01.up` queue that `MESSAGE_COUNT == 0` and `MESSAGES_ADDED += 1 (==3)` but `MESSAGES_ACKED += 0 (== 2)`. This is because the dummy message was rejected from `amqp10-converter`.

    ```
    $ ./scripts/activemq/stat_queue.sh
    ```
    ```text
    Connection brokerURL = tcp://localhost:61616
    |NAME                     |ADDRESS                  |CONSUMER_COUNT |MESSAGE_COUNT |MESSAGES_ADDED |DELIVERING_COUNT |MESSAGES_ACKED |SCHEDULED_COUNT |ROUTING_TYPE |
    |robot.robot01.down       |robot.robot01.down       |0              |0             |1              |0                |1              |0               |ANYCAST      |
    |robot.robot01.up         |robot.robot01.up         |1              |0             |3              |0                |2              |0               |ANYCAST      |
    ```
1. confirm the log of `amqp10-converter` that "no json schema matched this msg:" WARN message is shown.

    ```
    $ docker logs example_amqp10-converter_1
    ```
    ```text
    ...
    2020-09-06T04:53:38.249-0000 [DEBUG] amqp10 - received message: {"dummy":"dummy"}
    2020-09-06T04:53:38.249-0000 [ WARN] amqp10 - no json schema matched this msg: msg={"dummy":"dummy"}, schemas={"robot\\.robot01\\.up":["/opt/schema/attr.schema.json","/opt/schema/cmdexe.schema.json"]}
    ```
