module.exports = function (RED) {
  'use strict';

  function opensearchRefreshIndexNode(config) {
    try {
      const node = this;
      RED.nodes.createNode(node, config);

      // Получаем конфигурацию сервера OpenSearch
      const serverConfig = RED.nodes.getNode(config.server);
      if (!serverConfig || !serverConfig.client) {
        node.status({
          fill: 'red',
          shape: 'dot',
          text: 'No OpenSearch client found',
        });
        return;
      }

      node.status({});

      // Обработка входящих сообщений
      node.on('input', function (msg) {
        const indexConfig = {
          index: config.index, // Индекс из конфигурации узла
        };

        // Переопределение индекса из входящего сообщения
        if (msg.index) {
          indexConfig.index = msg.index;
        }

        // Выполнение запроса к OpenSearch
        serverConfig.client.indices
          .refresh(indexConfig)
          .then((resp) => {
            msg.payload = resp; // Возвращаем ответ от OpenSearch
            node.send(msg);
          })
          .catch((err) => {
            node.error('OpenSearch Refresh Index Error - ' + err);
            msg.payload = err; // Возвращаем ошибку
            node.send(msg);
          });
      });

      // Обработка ошибок узла
      node.on('error', function (error) {
        node.error('OpenSearch Refresh Index Node Error - ' + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on('close', function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error('OpenSearch Refresh Index Node Error - ' + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType(
    'opensearch-refresh-index',
    opensearchRefreshIndexNode
  );
};
