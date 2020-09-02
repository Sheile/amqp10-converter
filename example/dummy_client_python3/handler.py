from proton.handlers import MessagingHandler


class Handler(MessagingHandler):
    def __init__(self, host, port, use_tls, username, password, **kwargs):
        super().__init__(**kwargs)
        scheme = 'amqps' if use_tls else 'amqp'
        self.url = '{}://{}:{}'.format(scheme, host, port)
        self.options = {
            'sasl_enabled': True,
            'allowed_mechs': 'PLAIN',
            'user': username,
            'password': password,
        }
        self.connection = None
        self.handler = None

    def on_start(self, event):
        self.connection = event.container.connect(self.url, **self.options)
        self.handler = self._on_start(event)

    def shutdown(self):
        if self.handler is not None:
            self.handler.close()
        if self.connection is not None:
            self.connection.close()
