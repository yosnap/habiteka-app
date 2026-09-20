import { describe, expect, it } from 'vitest';
import { signUploadTicket, readUploadTicket, assertVideoUpload } from '@/server/walkthrough/upload-ticket';
const ticket={id:'upload',key:'uploads/org/project/file.mp4',organizationId:'org',userId:'user',projectId:'project',zoneId:null,routeId:'route',bytes:64,durationMs:10000,expires:1000};
describe('permisos y verificación de vídeo',()=>{
  it('firma el ámbito y rechaza modificaciones y caducidad',()=>{
    const signed=signUploadTicket(ticket,'secret');expect(readUploadTicket(signed,'secret',500)).toEqual(ticket);
    expect(()=>readUploadTicket(signed,'another-secret',500)).toThrow();
    expect(()=>readUploadTicket(signed,'secret',1001)).toThrow();
    expect(()=>readUploadTicket(signed+'x','secret',500)).toThrow();
  });
  it('verifica bytes/tipo y cabecera MP4 antes de publicar',()=>{
    const header=Buffer.from([0,0,0,32,...Buffer.from('ftypisom')]);
    expect(()=>assertVideoUpload(64,64,'video/mp4',header)).not.toThrow();
    expect(()=>assertVideoUpload(65,64,'video/mp4',header)).toThrow();
    expect(()=>assertVideoUpload(64,64,'text/html',header)).toThrow();
    expect(()=>assertVideoUpload(64,64,'video/mp4',Buffer.from('<script>'))).toThrow();
  });
});
