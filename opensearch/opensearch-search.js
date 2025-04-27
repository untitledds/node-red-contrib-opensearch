module.exports = function (RED) {
  'use strict';

  function OpenSearchSearchNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const serverConfig = RED.nodes.getNode(config.server);

    if (!serverConfig || !serverConfig.client) {
      node.status({ fill: 'red', shape: 'dot', text: 'No OpenSearch client' });
      return;
    }

    let abortScroll = () => {};

    node.on('input', async function (msg, send, done) {
      try {
        // Подготовка конфигурации поиска
        const searchConfig = {
          index: msg.index || config.index,
          body: msg.query || config.query || { query: { match_all: {} } },
          size: msg.size || config.size || 10,
          from: msg.from || config.from || 0,
        };

        // Инициализация выходных данных
        msg.payload = [];
        if (config.fullResponse) {
          msg.es_responses = [];
        }

        // Обработка scroll-запросов
        if (config.scroll || msg.scroll) {
          searchConfig.scroll = '1m';
          abortScroll = await processScrollSearch();
        } else {
          await processNormalSearch();
        }

        async function processNormalSearch() {
          try {
            const resp = await serverConfig.client.search(searchConfig);
            await processResponse(resp);
          } catch (err) {
            await handleError(err);
          } finally {
            if (done) done();
          }
        }

        async function processScrollSearch() {
          let scrollId = null;
          let isAborted = false;

          const cleanupScroll = async () => {
            if (scrollId && !isAborted) {
              try {
                await serverConfig.client.clearScroll({ scroll_id: scrollId });
              } catch (err) {
                node.error('Scroll cleanup error: ' + err.message);
              }
            }
          };

          const handleAbort = () => {
            isAborted = true;
          };

          try {
            const initialResponse = await serverConfig.client.search(
              searchConfig
            );
            await processScrollResponse(initialResponse);
          } catch (err) {
            await handleError(err);
          } finally {
            await cleanupScroll();
            if (done) done();
          }

          async function processScrollResponse(resp) {
            scrollId = resp.body._scroll_id;
            await processResponse(resp);

            if (resp.body.hits.hits.length === 0 || isAborted) {
              return;
            }

            try {
              const nextResponse = await serverConfig.client.scroll({
                scroll_id: scrollId,
                scroll: '1m',
              });
              await processScrollResponse(nextResponse);
            } catch (err) {
              await handleError(err);
              throw err;
            }
          }

          return handleAbort;
        }

        async function processResponse(resp) {
          if (resp.body?.hits?.hits) {
            const hitsData = resp.body.hits.hits.map((hit) => ({
              ...hit._source,
              meta: {
                id: hit._id,
                index: hit._index,
                score: hit._score,
              },
            }));

            if (config.bulkSize) {
              msg.payload.push(...hitsData);
              if (msg.payload.length >= config.bulkSize) {
                send([msg, null]);
                msg.payload = [];
              }
            } else {
              msg.payload = hitsData;
            }
          }

          if (config.fullResponse) {
            msg.es_responses = msg.es_responses || [];
            msg.es_responses.push(resp);
          }

          if (!config.scroll || resp.body.hits.hits.length === 0) {
            send([msg, null]);
          }
        }

        async function handleError(err) {
          node.error('Search error: ' + err.message, msg);
          msg.error = err;
          msg.payload = [];
          send([null, msg]);
        }
      } catch (err) {
        if (done) done(err);
        else node.error(err, msg);
      }
    });

    node.on('close', function (done) {
      abortScroll();
      done();
    });
  }

  RED.nodes.registerType('opensearch-search', OpenSearchSearchNode, {
    defaults: {
      name: { value: '' },
      server: { value: '' },
      index: { value: '' },
      query: { value: '' },
      size: { value: 10 },
      from: { value: 0 },
      scroll: { value: false },
      bulkSize: { value: 0 },
      fullResponse: { value: false },
    },
  });
};
