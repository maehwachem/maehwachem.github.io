const KONGSAE_EDGE = 'https://emynsoshduocpermxlfg.supabase.co/functions/v1/ks-drive';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files/';

function authorizeDrive() {
  return privateFolder_();
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 2200000) return reply_({ok:false});
    const envelope = JSON.parse(raw);
    if (!/^[0-9a-f]{64}$/.test(envelope.ticket) || typeof envelope.payload !== 'string') {
      return reply_({ok:false});
    }
    const digest = sha256_(Utilities.newBlob(envelope.payload).getBytes());
    const auth = UrlFetchApp.fetch(KONGSAE_EDGE + '?action=consume', {
      method:'post', contentType:'application/json', muteHttpExceptions:true,
      payload:JSON.stringify({ticket:envelope.ticket,digest:digest})
    });
    if (auth.getResponseCode() !== 200 || JSON.parse(auth.getContentText()).ok !== true) {
      return reply_({ok:false});
    }
    const req = JSON.parse(envelope.payload);
    if (req.action === 'ping') return reply_({ok:true, data:{privateFolder:!!privateFolder_()}});
    if (req.action === 'ids' && [1,2,3].indexOf(req.count) >= 0) {
      return reply_({ok:true,data:Drive.Files.generateIds({count:req.count,space:'drive',type:'files'}).ids});
    }
    const folder = privateFolder_();
    if (req.action === 'trash' && Array.isArray(req.jobs) && req.jobs.length <= 8) {
      const done = [];
      req.jobs.forEach(function(job) {
        try {
          validateBatch_(job);
          job.ids.forEach(function(id) {
            if (metadata_(id, folder, job.id)) drive_(id, 'delete');
          });
          done.push(job.id);
        } catch (_) { /* Keep failed jobs in the database for the next attempt. */ }
      });
      return reply_({ok:true,data:done});
    }
    validateBatch_(req);
    if (req.action === 'get') {
      const photos = req.ids.map(function(id, index) {
        if (!metadata_(id, folder, req.id)) throw Error('missing photo');
        const media = drive_(id + '?alt=media', 'get');
        if (media.getResponseCode() !== 200) throw Error('missing photo');
        return {photo_number:index + 1, jpeg:Utilities.base64Encode(media.getBlob().getBytes())};
      });
      return reply_({ok:true,data:photos});
    }
    if (req.action !== 'put' || !Array.isArray(req.photos) || req.photos.length !== req.ids.length) {
      return reply_({ok:false});
    }
    req.ids.forEach(function(id, index) {
      const photo = req.photos[index];
      if (typeof photo !== 'string' || photo.length > 699052) throw Error('invalid JPEG');
      const bytes = Utilities.base64Decode(photo);
      if (bytes.length < 5 || bytes.length > 524288 ||
          (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 || (bytes[2] & 255) !== 255 ||
          (bytes[bytes.length - 2] & 255) !== 255 || (bytes[bytes.length - 1] & 255) !== 217) {
        throw Error('invalid JPEG');
      }
      const hash = sha256_(bytes);
      let file = metadata_(id, folder, req.id);
      if (!file) {
        const name = req.id + '-' + (index + 1) + '.jpg';
        try {
          file = Drive.Files.create(
            {id:id, name:name, mimeType:'image/jpeg', parents:[folder], appProperties:{submission:req.id,digest:hash}},
            Utilities.newBlob(bytes, 'image/jpeg', name),
            {fields:'id,appProperties'}
          );
        } catch (err) {
          file = metadata_(id, folder, req.id);
          if (!file) throw err;
        }
      }
      if (file.appProperties.digest !== hash) throw Error('different retry payload');
    });
    return reply_({ok:true,data:null});
  } catch (_) {
    return reply_({ok:false});
  }
}

function privateFolder_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('KONGSAE_FOLDER_ID');
  if (!id) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      id = props.getProperty('KONGSAE_FOLDER_ID');
      if (!id) {
        id = Drive.Files.create(
          {name:'콩새 사진 제출함',mimeType:'application/vnd.google-apps.folder'},
          null, {fields:'id'}
        ).id;
        props.setProperty('KONGSAE_FOLDER_ID',id);
      }
    } finally { lock.releaseLock(); }
  }
  const sharing = Drive.Permissions.list(id,{fields:'permissions(type,role),nextPageToken'});
  const permissions = sharing.permissions || [];
  if (sharing.nextPageToken || permissions.length !== 1 ||
      permissions[0].type !== 'user' || permissions[0].role !== 'owner') throw Error('shared folder');
  return id;
}

function validateBatch_(batch) {
  if (!batch || !/^[0-9a-f-]{36}$/.test(batch.id) ||
      !Array.isArray(batch.ids) || batch.ids.length < 1 || batch.ids.length > 3 ||
      !batch.ids.every(function(id) {return typeof id === 'string' && /^[A-Za-z0-9_-]{10,150}$/.test(id);})) {
    throw Error('invalid batch');
  }
}

function metadata_(id, folder, submission) {
  const r = drive_(id + '?fields=id,mimeType,parents,trashed,appProperties','get');
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() !== 200) throw Error('Drive metadata unavailable');
  const file = JSON.parse(r.getContentText());
  if (file.trashed || file.mimeType !== 'image/jpeg' || !(file.parents || []).includes(folder) ||
      !file.appProperties || file.appProperties.submission !== submission) throw Error('file outside the submission');
  return file;
}

function drive_(path, method) {
  const r = UrlFetchApp.fetch(DRIVE_FILES + path, {
    method:method, headers:{Authorization:'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions:true
  });
  if (method === 'delete' && ![204,404].includes(r.getResponseCode())) throw Error('Drive cleanup failed');
  return r;
}

function sha256_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes)
    .map(function(b) { return (b & 255).toString(16).padStart(2,'0'); }).join('');
}

function reply_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
