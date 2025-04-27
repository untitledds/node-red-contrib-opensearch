module.exports = function (RED) {
  'use strict';

  function opensearchDataStreamNode(config) {
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

    node.on('input', async function (msg) {
      const dataStreamName = config.dataStream || msg.dataStream;

      if (!dataStreamName) {
        node.error('Data Stream name is required');
        return;
      }

      try {
        let response;

        switch (config.action) {
        case 'create':
          response = await serverConfig.client.indices.createDataStream({
            name: dataStreamName,
          });
          break;

        case 'delete':
          response = await serverConfig.client.indices.deleteDataStream({
            name: dataStreamName,
          });
          break;

        case 'stats':
          response = await serverConfig.client.indices.dataStreamsStats({
            name: dataStreamName,
          });
          break;

        default:
          throw new Error('Unknown action');
        }

        msg.payload = response;
        node.send(msg);
      } catch (error) {
        node.error(`OpenSearch Data Stream Error - ${error.message}`);
        msg.error = error;
        node.send(msg);
      }
    });
  }

  RED.nodes.registerType('opensearch-data-stream', opensearchDataStreamNode);
};
