import json
import os

from handler import Handler


host = os.environ.get('AMQP_HOST', 'localhost')
port = int(os.environ.get('AMQP_PORT', '5672'))
use_tls = os.environ.get('AMQP_USE_TLS', 'False').lower() == 'true'
username = os.environ.get('AMQP_RECEIVER_USERNAME', 'ANONYMOUS')
password = os.environ.get('AMQP_RECEIVER_PASSWORD', '')
queue = os.environ.get('AMQP_RECEIVE_QUEUE', 'examples')


class Consumer(Handler):
    def __init__(self, callback):
        super().__init__(host, port, use_tls, username, password,
                         auto_accept=False)
        self.callback = callback

    def _on_start(self, event):
        return event.container.create_receiver(self.connection, queue)

    def on_message(self, event):
        msg = event.message.body
        print('consuming message', msg)
        try:
            self.callback(json.loads(msg))
            self.accept(event.delivery)
            print('consumed message successfully')
        except Exception as e:
            self.release(event.delivery)
            print('consumed message error', e)
        finally:
            self.shutdown()
