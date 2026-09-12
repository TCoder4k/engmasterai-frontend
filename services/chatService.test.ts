import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendChatMessageStream } from './chatService';
import { ApiError } from './apiError';
import { authService } from './authService';

const encoder = new TextEncoder();

/** A fake streaming Response whose body yields exactly the given raw text pieces, one per `reader.read()` call. */
const streamResponse = (pieces: string[]): Response => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
};

const sseFrame = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendChatMessageStream', () => {
  it('calls onDelta for each delta frame, in order, then onDone for the done frame', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('token');
    vi.spyOn(global, 'fetch').mockResolvedValue(
      streamResponse([
        sseFrame('delta', { text: 'Hello ' }),
        sseFrame('delta', { text: 'there!' }),
        sseFrame('done', { clientMessageId: 'x', reply: 'Hello there!', repliedAt: 't' }),
      ]),
    );
    const deltas: string[] = [];
    let done: unknown;

    await sendChatMessageStream('x', 'hi', { type: 'GENERAL' }, {
      onDelta: (text) => deltas.push(text),
      onDone: (result) => {
        done = result;
      },
    });

    expect(deltas).toEqual(['Hello ', 'there!']);
    expect(done).toEqual({ clientMessageId: 'x', reply: 'Hello there!', repliedAt: 't' });
  });

  // 2026-09-12 review finding — same reasoning as the backend's own
  // sse-frame-reader tests: a naive per-read split silently mangles a frame
  // straddling two reads, or drops all but the first of several frames
  // delivered together. Mocking "one read == one frame" would never catch
  // either bug, on either side of the wire.
  it('reassembles an SSE frame whose data line is split across two network reads', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('token');
    const wholeFrame = sseFrame('delta', { text: 'Hello there' });
    const splitPoint = Math.floor(wholeFrame.length / 2);
    vi.spyOn(global, 'fetch').mockResolvedValue(
      streamResponse([
        wholeFrame.slice(0, splitPoint),
        wholeFrame.slice(splitPoint),
        sseFrame('done', { clientMessageId: 'x', reply: 'Hello there', repliedAt: 't' }),
      ]),
    );
    const deltas: string[] = [];

    await sendChatMessageStream('x', 'hi', { type: 'GENERAL' }, {
      onDelta: (text) => deltas.push(text),
      onDone: () => {},
    });

    expect(deltas).toEqual(['Hello there']);
  });

  it('processes multiple SSE frames that arrive together in a single network read', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('token');
    const combined =
      sseFrame('delta', { text: 'Hel' }) +
      sseFrame('delta', { text: 'lo' }) +
      sseFrame('done', { clientMessageId: 'x', reply: 'Hello', repliedAt: 't' });
    vi.spyOn(global, 'fetch').mockResolvedValue(streamResponse([combined]));
    const deltas: string[] = [];

    await sendChatMessageStream('x', 'hi', { type: 'GENERAL' }, {
      onDelta: (text) => deltas.push(text),
      onDone: () => {},
    });

    expect(deltas).toEqual(['Hel', 'lo']);
  });

  it('accepts \\r\\n\\r\\n as the frame terminator, not just \\n\\n', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('token');
    vi.spyOn(global, 'fetch').mockResolvedValue(
      streamResponse([
        `event: delta\r\ndata: ${JSON.stringify({ text: 'Hi there.' })}\r\n\r\n`,
        `event: done\r\ndata: ${JSON.stringify({ clientMessageId: 'x', reply: 'Hi there.', repliedAt: 't' })}\r\n\r\n`,
      ]),
    );
    const deltas: string[] = [];

    await sendChatMessageStream('x', 'hi', { type: 'GENERAL' }, {
      onDelta: (text) => deltas.push(text),
      onDone: () => {},
    });

    expect(deltas).toEqual(['Hi there.']);
  });

  it('rejects with the server-provided message on an `error` frame mid-stream', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('token');
    vi.spyOn(global, 'fetch').mockResolvedValue(
      streamResponse([
        sseFrame('delta', { text: 'partial' }),
        sseFrame('error', { message: 'Engy is temporarily unavailable' }),
      ]),
    );

    await expect(
      sendChatMessageStream('x', 'hi', { type: 'GENERAL' }, { onDelta: () => {}, onDone: () => {} }),
    ).rejects.toThrow('Engy is temporarily unavailable');
  });

  it('a pre-stream HTTP error (e.g. 403 assessment lock) still throws a normal ApiError, never attempting to read a stream', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('token');
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Assessment in progress', code: 'ASSESSMENT_IN_PROGRESS' }),
    } as unknown as Response);

    await expect(
      sendChatMessageStream('x', 'hi', { type: 'GENERAL' }, { onDelta: () => {}, onDone: () => {} }),
    ).rejects.toMatchObject({ status: 403, code: 'ASSESSMENT_IN_PROGRESS' } satisfies Partial<ApiError>);
  });
});
