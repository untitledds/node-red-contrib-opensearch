module.exports = function (RED) {
  'use strict';

  function opensearchDeleteByQueryNode(config) {
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
        const deleteConfig = {
          index: config.index, // Индекс из конфигурации узла
          body: msg.payload, // Тело запроса из входящего сообщения
        };

        // Переопределение индекса из входящего сообщения
        if (msg.index) {
          deleteConfig.index = msg.index;
        }

        // Проверка наличия тела запроса
        if (!deleteConfig.body) {
          node.status({
            fill: 'red',
            shape: 'dot',
            text: 'No query to delete',
          });
          return;
        }

        // Выполнение запроса к OpenSearch
        serverConfig.client
          .deleteByQuery(deleteConfig)
          .then((resp) => {
            msg.payload = resp; // Возвращаем ответ от OpenSearch
            node.send(msg);
          })
          .catch((err) => {
            node.error('OpenSearch Delete By Query Node Error - ' + err);
            msg.payload = err; // Возвращаем ошибку
            node.send(msg);
          });
      });

      // Обработка ошибок узла
      node.on('error', function (error) {
        node.error('OpenSearch Delete By Query Node Error - ' + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on('close', function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error('OpenSearch Delete By Query Node Error - ' + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType(
    'opensearch-deleteByQuery',
    opensearchDeleteByQueryNode
  );
};
