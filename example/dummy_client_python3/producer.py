import json
import os

from proton import Message

from handler import Handler


host = os.environ.get('AMQP_HOST', 'localhost')
port = int(os.environ.get('AMQP_PORT', '5672'))
use_tls = os.environ.get('AMQP_USE_TLS', 'False').lower() == 'true'
username = os.environ.get('AMQP_SENDER_USERNAME', 'ANONYMOUS')
password = os.environ.get('AMQP_SENDER_PASSWORD', '')
queue = os.environ.get('AMQP_SEND_QUEUE', 'examples')


class Producer(Handler):
    def __init__(self, payload):
        super().__init__(host, port, use_tls, username, password)
        self.msg = json.dumps(payload)

    def _on_start(self, event):
        return event.container.create_sender(self.connection, queue)

    def on_sendable(self, event):
        print('producing message', self.msg)
        self.handler.send(Message(body=self.msg))
        print('produced message successfully')
        self.shutdown()
