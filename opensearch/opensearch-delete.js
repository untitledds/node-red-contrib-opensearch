module.exports = function (RED) {
  'use strict';

  function opensearchDeleteNode(config) {
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
        };

        // Переопределение индекса из входящего сообщения
        if (msg.index) {
          deleteConfig.index = msg.index;
        }

        // Извлечение ID документа
        if (config.esId) {
          deleteConfig.id = config.esId; // ID из конфигурации узла
        } else if (msg.id) {
          deleteConfig.id = msg.id; // ID из входящего сообщения
        } else if (msg.payload?._id) {
          deleteConfig.id = msg.payload._id; // ID из тела сообщения
          delete msg.payload._id; // Удаляем _id из тела сообщения
        }

        // Проверка наличия ID
        if (!deleteConfig.id) {
          node.status({
            fill: 'red',
            shape: 'dot',
            text: 'No id to delete',
          });
          return;
        }

        // Выполнение запроса к OpenSearch
        serverConfig.client
          .delete(deleteConfig)
          .then((resp) => {
            msg.payload = resp; // Возвращаем ответ от OpenSearch
            node.send(msg);
          })
          .catch((err) => {
            node.error('OpenSearch Delete Node Error - ' + err);
            msg.payload = err; // Возвращаем ошибку
            node.send(msg);
          });
      });

      // Обработка ошибок узла
      node.on('error', function (error) {
        node.error('OpenSearch Delete Node Error - ' + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on('close', function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error('OpenSearch Delete Node Error - ' + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType('opensearch-delete', opensearchDeleteNode);
};
