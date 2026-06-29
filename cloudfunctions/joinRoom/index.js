const cloud = require('../../utils/cloud.js')

exports.main = async (event, context) => {
  return await cloud._internal.CLOUD_FUNCTIONS.joinRoom(event, context)
}
