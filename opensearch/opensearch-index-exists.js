module.exports = function (RED) {
  'use strict';

  function opensearchIndexExistsNode(config) {
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
        serverConfig.client.cat
          .indices(indexConfig)
          .then((_resp) => {
            msg.payload = true; // Индекс существует
            node.send(msg);
          })
          .catch((_err) => {
            msg.payload = false; // Индекс не существует
            node.send(msg);
          });
      });

      // Обработка ошибок узла
      node.on('error', function (error) {
        node.error('OpenSearch Index Exists Node Error - ' + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on('close', function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error('OpenSearch Index Exists Node Error - ' + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType('opensearch-index-exists', opensearchIndexExistsNode);
};
