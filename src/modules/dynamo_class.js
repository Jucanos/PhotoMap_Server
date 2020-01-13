const { representsDefault, isUndefined, uuid } = require('./util');

exports.parseClass = function(doc) {
  doc = doc.originalItem();

  const type = doc.type.split('.');
  delete doc.type;

  let obj;

  switch (type[0]) {
    case 'USER':
      obj = new this.User(doc);
      break;
    case 'MAP':
      obj = new this.Map(doc);
      break;
    case 'USER-MAP':
      obj = new this.UserMap(doc);
      break;
    case 'STORY':
      doc.cityKey = type[1];
      obj = new this.Story(doc);
      break;
    case 'LOG':
      obj = new this.Log(doc);
      break;
  }

  return obj;
};

class Data {
  constructor(options = {}) {
    if (!isUndefined(options.createdAt)) this.createdAt = options.createdAt;

    if (!isUndefined(options.updatedAt)) this.updatedAt = options.updatedAt;

    if (isUndefined(options.content)) {
      Object.assign(this, options);
    } else {
      Object.assign(this, options.content);
    }
  }

  update(obj) {
    Object.assign(this, obj);
  }
}

exports.User = class User extends Data {
  constructor(options = {}) {
    super(options);

    // DB에서 가져온 경우 content가 존재
    if (!isUndefined(options.content)) {
      this.uid = options.PK;
    }
  }

  json() {
    return {
      PK: this.uid,
      SK: 'INFO',
      type: 'USER',
      content: {
        nickname: this.nickname,
        thumbnail: this.thumbnail,
      },
    };
  }

  equal(user) {
    return this.nickname === user.nickname && this.thumbnail === user.thumbnail;
  }
};

exports.Map = class Map extends Data {
  constructor(options = {}) {
    super(options);

    // DB에서 가져온 경우 content가 존재
    if (!isUndefined(options.content)) {
      this.mid = options.PK;
    }

    // mid 기본값
    if (isUndefined(this.mid)) {
      this.mid = uuid();
    }

    // represents 초기화
    if (isUndefined(this.represents)) {
      this.represents = {};
      representsDefault.forEach(city => {
        this.represents[city] = null;
      });
    }
  }

  json() {
    return {
      PK: this.mid,
      SK: 'INFO',
      type: 'MAP',
      content: {
        represents: this.represents,
      },
    };
  }
};

exports.UserMap = class UserMap extends Data {
  constructor(options = {}) {
    super(options);

    // DB에서 가져온 경우 content가 존재
    if (!isUndefined(options.content)) {
      this.mid = options.PK;
      this.uid = options.SK;
    }
  }

  json() {
    return {
      PK: this.mid,
      SK: this.uid,
      type: 'USER-MAP',
    };
  }
};

exports.Story = class Story extends Data {
  constructor(options = {}) {
    super(options);

    // DB에서 가져온 경우 content가 존재
    if (!isUndefined(options.content)) {
      this.sid = options.PK;
      this.mid = options.SK;
      this.cityKey = options.cityKey;
    }

    // sid 기본값
    if (isUndefined(this.sid)) {
      this.sid = uuid();
    }
  }

  json() {
    return {
      PK: this.sid,
      SK: this.mid,
      type: `STORY.${this.cityKey}`,
      content: {
        title: this.title,
        context: this.context,
        files: this.files,
      },
    };
  }
};

exports.Log = class Log extends Data {
  constructor(options = {}) {
    super(options);

    // DB에서 가져온 경우 content가 존재
    if (!isUndefined(options.content)) {
      this.lid = options.PK;
      this.mid = options.SK;
    }

    // lid 기본값
    if (isUndefined(this.sid)) {
      this.lid = uuid();
    }
  }

  json() {
    return {
      PK: this.lid,
      SK: this.mid,
      type: 'LOG',
      content: {
        uid: this.uid,
        data: this.data,
        cityKey: this.cityKey,
      },
    };
  }
};
