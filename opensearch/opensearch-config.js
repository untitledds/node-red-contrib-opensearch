module.exports = function (RED) {
  'use strict';
  const { Client } = require('@opensearch-project/opensearch'); // Импортируем клиент OpenSearch

  function serverConfigNode(config) {
    const node = this;
    RED.nodes.createNode(node, config);

    // Инициализация параметров
    node.server = config.server;
    node.name = config.name;
    node.timeout = config.timeout || 30000;
    node.disableSSL = config.disableSSL;
    node.auth = {
      type: config.auth,
      username: config.username,
      password: config.password,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    };

    createClient(node);

    // Обработка ошибок
    node.on('error', function (error) {
      node.error('OpenSearch Server Error - ' + error);
    });

    // Очистка ресурсов при закрытии узла
    node.on('close', function (done) {
      if (node.client) {
        node.client.close(); // Закрытие клиента OpenSearch
      }
      done();
    });
  }

  function createClient(node) {
    try {
      const clientConfig = {
        node: node.server,
        requestTimeout: node.timeout,
        ssl: { rejectUnauthorized: !node.disableSSL },
      };

      if (node.auth.type !== 'none') {
        clientConfig.auth =
          node.auth.type === 'basic'
            ? {
              username: node.auth.username,
              password: node.auth.password,
            }
            : {
              accessKeyId: node.auth.accessKey,
              secretAccessKey: node.auth.secretKey,
              region: node.auth.region,
              service: 'es',
            };
      }
      node.client = new Client(clientConfig);
      // Логирование событий
      node.client.on('request', (err, meta) => {
        if (err) {
          node.error(`Request Error: ${err}`);
        } else {
          node.log(`Request Sent: ${JSON.stringify(meta)}`);
        }
      });

      node.client.on('response', (err, meta) => {
        if (err) {
          node.error(`Response Error: ${err}`);
        } else {
          node.log(`Response Received: ${JSON.stringify(meta)}`);
        }
      });

      node.client.on('sniff', (err, meta) => {
        if (err) {
          node.error(`Sniff Error: ${err}`);
        } else {
          node.log(`Sniff Event: ${JSON.stringify(meta)}`);
        }
      });

      node.client.on('resurrect', (err, meta) => {
        if (err) {
          node.error(`Resurrect Error: ${err}`);
        } else {
          node.log(`Resurrect Event: ${JSON.stringify(meta)}`);
        }
      });
    } catch (err) {
      node.error('createClient - ' + err);
    }
  }
  RED.nodes.registerType('opensearch-config', serverConfigNode, {});
  RED.httpAdmin.post(
    '/opensearch/test-connection',
    RED.auth.needsPermission('opensearch.write'),
    async function (req, res) {
      const { Client } = require('@opensearch-project/opensearch');

      try {
        // Подготовка конфигурации клиента
        const clientConfig = {
          node: req.body.server,
          requestTimeout: parseInt(req.body.timeout || 30000),
          ssl: { rejectUnauthorized: !req.body.disableSSL },
        };

        // Настройка аутентификации
        if (req.body.auth && req.body.auth !== 'none') {
          if (req.body.auth === 'basic') {
            clientConfig.auth = {
              username: req.body.username,
              password: req.body.password,
            };
          } else {
            clientConfig.auth = {
              accessKeyId: req.body.accessKey,
              secretAccessKey: req.body.secretKey,
              region: req.body.region,
              service: 'es',
            };
          }
        }

        // Создание клиента и тестирование
        const client = new Client(clientConfig);

        // Добавляем таймаут
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Connection timeout after 10s')),
            10000
          )
        );

        const pingPromise = client.ping();

        try {
          await Promise.race([pingPromise, timeoutPromise]);
          res.json({ success: true, message: 'Connection successful' });
        } finally {
          await client.close(); // Закрываем клиент в любом случае
        }
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message,
          details:
            process.env.NODE_ENV === 'development' ? err.stack : undefined,
        });
      }
    }
  );
};
