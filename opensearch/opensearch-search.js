module.exports = function (RED) {
  "use strict";

  function opensearchSearchNode(config) {
    try {
      const node = this;
      RED.nodes.createNode(node, config);

      // Получаем конфигурацию сервера OpenSearch
      const serverConfig = RED.nodes.getNode(config.server);
      if (!serverConfig || !serverConfig.client) {
        node.status({
          fill: "red",
          shape: "dot",
          text: "No OpenSearch client found",
        });
        return;
      }

      node.status({});

      // Обработка входящих сообщений
      node.on("input", function (msg) {
        const searchConfig = {
          index: config.index, // Индекс из конфигурации узла
          body: config.query, // Запрос из конфигурации узла
          size: config.size, // Количество результатов
          from: config.from, // Смещение
        };

        // Переопределение индекса из входящего сообщения
        if (msg.index) {
          searchConfig.index = msg.index;
        }

        // Переопределение запроса из входящего сообщения
        if (msg.query) {
          searchConfig.body = msg.query;
        }

        // Переопределение размера страницы
        searchConfig.size = 10; // По умолчанию
        if (config.size) {
          searchConfig.size = config.size;
        }
        if (msg.size) {
          searchConfig.size = msg.size;
        }

        // Переопределение смещения
        if (msg.from) {
          searchConfig.from = msg.from;
        }

        // Поддержка scroll
        if (config.scroll || msg.scroll) {
          searchConfig.scroll = "1m"; // Время жизни scroll-курсора
        }

        // Инициализация payload и es_responses
        msg.payload = [];
        if (config.fullResponse) {
          msg.es_responses = [];
        }

        // Выполнение запроса к OpenSearch
        serverConfig.client.search(searchConfig).then(
          function (resp) {
            (function next(resp) {
              // Добавление полного ответа, если требуется
              if (config.fullResponse) {
                msg.es_responses.push(resp);
              }

              // Проверка наличия результатов
              if (!resp.hits || !resp.hits.hits || !resp.hits.hits.length) {
                if (msg.payload.length > 0) {
                  node.send(msg); // Отправляем оставшиеся данные
                }
                return;
              }

              // Обработка найденных документов
              if (config.bulkSize) {
                // Пакетная обработка
                for (const hit of resp.hits.hits) {
                  msg.payload.push({
                    _source: hit._source,
                    _id: hit._id,
                  });

                  // Отправка данных пакетами
                  if (msg.payload.length % config.bulkSize === 0) {
                    node.send({ ...msg }); // Клонируем msg
                    msg.payload = [];
                  }
                }
              } else {
                // Полная загрузка
                msg.payload = resp.hits.hits.map((hit) => ({
                  ...hit._source,
                  _meta: {
                    id: hit._id,
                    index: hit._index,
                    score: hit._score,
                  },
                }));
              }

              // Если scroll не используется, отправляем оставшиеся данные
              if (!searchConfig.scroll || !resp.hits.hits.length) {
                if (msg.payload.length > 0) {
                  node.send(msg); // Отправляем оставшиеся данные
                }
                return;
              }

              // Продолжение scroll-запроса
              if (searchConfig.scroll) {
                const scrollId = resp._scroll_id;
                serverConfig.client
                  .scroll({
                    scroll: "1m",
                    scroll_id: scrollId,
                  })
                  .then(next)
                  .catch((err) => node.error("Scroll error: " + err));
              }
            })(resp);
          },
          function (err) {
            node.error("OpenSearch Search Node Error - " + err.message);
            msg.payload = [];
            msg.error = err;
            node.send(msg);
          }
        );
      });

      // Обработка ошибок узла
      node.on("error", function (error) {
        node.error("OpenSearch Search Node Error - " + error);
      });

      // Очистка ресурсов при закрытии узла
      node.on("close", function (done) {
        if (node.client) {
          delete node.client;
        }
        done();
      });
    } catch (err) {
      node.error("OpenSearch Search Node Error - " + err);
    }
  }

  // Регистрация типа узла
  RED.nodes.registerType("opensearch-search", opensearchSearchNode);
};
