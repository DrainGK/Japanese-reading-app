const GZIP_MAGIC_1 = 0x1f;
const GZIP_MAGIC_2 = 0x8b;

function needsGzipWrapper(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return bytes[0] !== GZIP_MAGIC_1 || bytes[1] !== GZIP_MAGIC_2;
}

async function gzipArrayBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof CompressionStream === 'undefined') {
    return buffer;
  }

  const compressedStream = new Blob([buffer]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(compressedStream).arrayBuffer();
}

function isKuromojiDictionaryUrl(url: string): boolean {
  return /\/dict\/.*\.dat\.gz(?:\?|$)/.test(url);
}

class KuromojiDictionaryXMLHttpRequest {
  responseType: XMLHttpRequestResponseType = '' as XMLHttpRequestResponseType;
  response: ArrayBuffer | string | null = null;
  status = 0;
  statusText = '';
  onload: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null = null;
  onerror: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null = null;

  private url = '';

  open(_method: string, url: string, _async = true): void {
    this.url = url;
  }

  async send(): Promise<void> {
    try {
      const response = await fetch(this.url, { cache: 'no-cache' });

      if (!response.ok) {
        throw new Error(`Failed to load ${this.url}: ${response.status} ${response.statusText}`);
      }

      let buffer = await response.arrayBuffer();
      if (needsGzipWrapper(buffer)) {
        buffer = await gzipArrayBuffer(buffer);
      }

      this.status = 200;
      this.statusText = 'OK';
      this.response = buffer;
      this.onload?.call(this as unknown as XMLHttpRequest, new ProgressEvent('load'));
    } catch (error) {
      this.status = 0;
      this.statusText = error instanceof Error ? error.message : 'Failed to load dictionary';
      this.onerror?.call(this as unknown as XMLHttpRequest, new ProgressEvent('error'));
    }
  }
}

export function installKuromojiCompatibilityLayer(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const nativeXMLHttpRequest = window.XMLHttpRequest;

  window.XMLHttpRequest = class PatchedXMLHttpRequest {
    private inner: XMLHttpRequest | KuromojiDictionaryXMLHttpRequest | null = null;

    open(method: string, url: string, async = true): void {
      if (isKuromojiDictionaryUrl(url)) {
        this.inner = new KuromojiDictionaryXMLHttpRequest();
      } else {
        this.inner = new nativeXMLHttpRequest();
      }

      this.inner.open(method, url, async);
    }

    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      if (!this.inner) {
        this.inner = new nativeXMLHttpRequest();
      }

      if (this.inner instanceof KuromojiDictionaryXMLHttpRequest) {
        void this.inner.send();
        return;
      }

      this.inner.send(body ?? null);
    }

    set responseType(value: XMLHttpRequestResponseType) {
      if (this.inner) {
        this.inner.responseType = value;
      }
    }

    get responseType(): XMLHttpRequestResponseType {
      return (this.inner?.responseType ?? '') as XMLHttpRequestResponseType;
    }

    get response(): any {
      return this.inner?.response ?? null;
    }

    get status(): number {
      return this.inner?.status ?? 0;
    }

    get statusText(): string {
      return this.inner?.statusText ?? '';
    }

    set onload(handler: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null) {
      if (this.inner) {
        this.inner.onload = handler;
      }
    }

    get onload(): ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null {
      return this.inner?.onload ?? null;
    }

    set onerror(handler: ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null) {
      if (this.inner) {
        this.inner.onerror = handler;
      }
    }

    get onerror(): ((this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => unknown) | null {
      return this.inner?.onerror ?? null;
    }
  } as unknown as typeof XMLHttpRequest;
}