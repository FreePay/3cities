
// An inline fork of
// https://raw.githubusercontent.com/niklasvh/base64-arraybuffer/master/src/index.ts
// that removes the need for URL encoding the base64'd result because it
// replaces the data char '+' with '-', the data char '/' with '_', and
// the padding char '=' with '.'

// NB because in our implementation, the padding char '.' is put at the
// end of the base64 string if padding is necessary, it's usually the
// case that our generated links end in periods. This is a confusing UX
// because it's unclear to the user if the period on the end of a link
// is part of the link or if it's a period in a sentence in which the
// link appears. Eg. "Hi please pay <link>." <-- is that trailing period
// part of the link or sentence? The bad news is, it's impossible for an
// arbitrary web context to determine if the last period is part of the
// link or the sentence, so eg. twitter might truncate the last period
// when shortening a 3cities generated link (or not shortening and
// simply auto-detecting the url to make it clickable). The great news
// is, the trailing periods are padding characters and many base64
// decoders, including ours, treat these trailing padding chars
// optional, so our generated links will be successfully decoded by our
// decoder even if the trailing padding periods are truncated by the web
// context. WARNING this explains why the period must be the padding
// char and not a data char --> because if we used '.' as the
// substitution for a data char like '/' then when a website truncates
// the trailing period, it would be truncating data and the resulting
// deserialization would be corrupted and fail.

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const lookup: Readonly<Uint8Array> = (() => {
  const a = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    a[chars.charCodeAt(i)] = i;
  }
  return a;
})();

// modifiedBase64Encode returns the passed ArrayBuffer as a
// base64-encoded string. The canonical base64 algorithm has been
// modified to make the returned string require no URL encoding. If the
// returned string's last two chars are the padding char '.', these last
// two chars may be safely truncated prior to decoding with
// modifiedBase64Decode. See note at top about choice of padding char.
export function modifiedBase64Encode(arraybuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arraybuffer);
  const len = bytes.length;
  let i, base64 = '';

  for (i = 0; i < len; i += 3) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Object is possibly 'undefined'
    base64 += chars[bytes[i] >> 2];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Object is possibly 'undefined'
    base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Object is possibly 'undefined'
    base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Object is possibly 'undefined'
    base64 += chars[bytes[i + 2] & 63];
  }

  if (len % 3 === 2) {
    base64 = base64.substring(0, base64.length - 1) /*+ '.' // NB here we omit the padding char '.' because our base64 decoder doesn't require it and it makes links one char shorter */;
  } else if (len % 3 === 1) {
    base64 = base64.substring(0, base64.length - 2) /*+ + '..' // NB here we omit the padding chars '..' because our base64 decoder doesn't require them and it makes links two chars shorter */;
  } else {
    // len % 3 === 0 which indicates the input byte array length is
    // perfectly divisible by 3. In Base64 encoding, each set of 3 bytes
    // is encoded into 4 Base64 characters. So if the byte array length
    // is a multiple of 3, no padding is needed, making this case a
    // no-op.
  }

  return base64;
}

const modifiedBase64ValidCharsRegex = /^[A-Za-z0-9-_]*[.]{0,2}$/;

// modifiedBase64Decode decodes the passed string into an ArrayBuffer.
// The passed string must have been encoded with modifiedBase64Encode.
// If the last two chars in the string returned by modifiedBase64Encode
// are the padding char '.', they may be safely truncated from the
// passed string without affecting decoding. See note at top about
// choice of padding char.
export function modifiedBase64Decode(base64: string): ArrayBuffer {
  if (!modifiedBase64ValidCharsRegex.test(base64)) throw new Error('modifiedBase64Decode: invalid input string ' + base64);
  const len = base64.length;
  let bufferLength = base64.length * 0.75,
    i,
    p = 0,
    encoded1,
    encoded2,
    encoded3,
    encoded4;

  if (base64[base64.length - 1] === '.') {
    bufferLength--;
    if (base64[base64.length - 2] === '.') {
      bufferLength--;
    }
  }

  const arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

  for (i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Object is possibly 'undefined'
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Object is possibly 'undefined'
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Object is possibly 'undefined'
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return arraybuffer;
}
