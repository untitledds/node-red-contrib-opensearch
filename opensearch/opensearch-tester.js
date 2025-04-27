module.exports = function (RED) {
  const { Client } = require('@opensearch-project/opensearch');

  function OpenSearchTester(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    // Обработчик входящих сообщений
    node.on('input', function (msg, send, done) {
      try {
        // Подготовка конфигурации клиента
        const clientConfig = {
          node: msg.server || config.server,
          requestTimeout: parseInt(msg.timeout || config.timeout || 30000),
          ssl: {
            rejectUnauthorized: !(msg.disableSSL ?? config.disableSSL ?? false),
          },
        };

        // Настройка аутентификации
        const authType = msg.auth || config.auth;
        if (authType && authType !== 'none') {
          if (authType === 'basic') {
            clientConfig.auth = {
              username: msg.username || config.username,
              password: msg.password || this.credentials.password,
            };
          } else if (authType === 'aws') {
            clientConfig.auth = {
              accessKeyId: msg.accessKey || config.accessKey,
              secretAccessKey: msg.secretKey || this.credentials.secretKey,
              region: msg.region || config.region,
              service: 'es',
            };
          }
        }

        // Создание клиента и тестирование
        const client = new Client(clientConfig);
        const timer = setTimeout(() => {
          done(new Error('Connection timeout (10s exceeded)'));
        }, 10000);

        client
          .ping()
          .then(() => {
            clearTimeout(timer);
            send({
              payload: {
                status: 'success',
                message: 'Connection established',
                config: {
                  node: clientConfig.node,
                  authType: authType,
                },
              },
            });
            done();
          })
          .catch((err) => {
            clearTimeout(timer);
            done(err);
          });
      } catch (err) {
        done(err);
      }
    });

    // Закрытие соединений при удалении ноды
    node.on('close', function (done) {
      if (node.client) {
        node.client.close().finally(done);
      } else {
        done();
      }
    });
  }

  // Регистрация типа ноды
  RED.nodes.registerType('opensearch-tester', OpenSearchTester, {
    // Настройки для редактора
    defaults: {
      name: { value: '' },
      server: { value: 'http://localhost:9200' },
      timeout: { value: 30000 },
      auth: { value: 'none' },
      username: { value: '' },
      accessKey: { value: '' },
      region: { value: 'us-east-1' },
      disableSSL: { value: false },
    },
    credentials: {
      password: { type: 'password' },
      secretKey: { type: 'password' },
    },
    // Скрываем ноду в палитре
    hidden: true,
  });
};
