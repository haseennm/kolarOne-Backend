import {  VoiceCommandReq } from "./voice.assistance.types";
import VoiceAssistService from "./voice.assistance.service";

export default class VoiceAssistController {
  async voiceAssist(data: VoiceCommandReq) {
    const service = new VoiceAssistService()
    return service.voiceCommand(data)
  }
}