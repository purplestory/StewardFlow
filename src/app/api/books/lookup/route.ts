import { NextResponse } from "next/server";

type BookLookupPayload = {
  isbn: string;
  title: string | null;
  author: string | null;
  publisher: string | null;
  publishedYear: number | null;
  coverImageUrl: string | null;
  description: string | null;
  source:
    | "data4library"
    | "nationallibrary"
    | "naverbook"
    | "openlibrary"
    | "googlebooks";
};

type LookupSource =
  | "data4library"
  | "nationallibrary"
  | "naverbook"
  | "openlibrary"
  | "googlebooks";
type AttemptStatus = "hit" | "miss" | "skipped_no_key" | "error";
type LookupAttempt = {
  source: LookupSource;
  status: AttemptStatus;
  book: BookLookupPayload | null;
  detail?: string;
};

type LookupSkipDetails = {
  detail?: string;
};

const SOURCE_LABELS: Record<LookupSource, string> = {
  data4library: "도서관정보나루",
  nationallibrary: "국립중앙도서관",
  naverbook: "네이버 도서",
  openlibrary: "Open Library",
  googlebooks: "Google Books",
};

const NAVER_CLIENT_ID_ENV_KEYS = [
  "NAVER_CLIENT_ID",
  "NAVER_SEARCH_CLIENT_ID",
] as const;

const NAVER_CLIENT_SECRET_ENV_KEYS = [
  "NAVER_CLIENT_SECRET",
  "NAVER_SEARCH_CLIENT_SECRET",
] as const;

const DATA4LIBRARY_ENV_KEYS = ["DATA4LIBRARY_AUTH_KEY"] as const;
const NATIONAL_LIBRARY_ENV_KEYS = ["NATIONAL_LIBRARY_CERT_KEY"] as const;

function normalizeIsbn(input: string): string {
  return input.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function parseYear(input: string | null | undefined): number | null {
  if (!input) return null;
  const match = input.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isNaN(year) ? null : year;
}

function normalizeText(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDescription(
  input: string | { value?: string | null } | null | undefined
): string | null {
  if (!input) return null;
  if (typeof input === "string") return normalizeText(input);
  if (typeof input === "object") return normalizeText(input.value ?? null);
  return null;
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalizeUnknownText(input: unknown): string | null {
  if (typeof input === "string") return normalizeText(input);
  if (typeof input === "number") return String(input);
  return null;
}

function getCaseInsensitiveField(
  record: Record<string, unknown>,
  candidateKeys: string[]
): string | null {
  const keySet = new Set(candidateKeys.map((key) => key.toLowerCase()));
  for (const [key, value] of Object.entries(record)) {
    if (!keySet.has(key.toLowerCase())) continue;
    const normalized = normalizeUnknownText(value);
    if (normalized) return normalized;
  }
  return null;
}

function findNationalLibraryRecord(node: unknown): Record<string, unknown> | null {
  const queue: unknown[] = [node];
  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (!current || typeof current !== "object") continue;

    const record = current as Record<string, unknown>;
    const title = getCaseInsensitiveField(record, [
      "TITLE",
      "TITLE_INFO",
      "title",
      "bookname",
      "BOOKNAME",
    ]);
    const author = getCaseInsensitiveField(record, ["AUTHOR", "authors", "author"]);
    const publisher = getCaseInsensitiveField(record, ["PUBLISHER", "publisher"]);
    const isbn = getCaseInsensitiveField(record, [
      "EA_ISBN",
      "SET_ISBN",
      "ISBN",
      "isbn",
      "isbn13",
    ]);

    if (title || author || publisher || isbn) {
      return record;
    }

    queue.push(...Object.values(record));
  }
  return null;
}

function mergeBookPayload(
  primary: BookLookupPayload,
  supplement: BookLookupPayload | null
): BookLookupPayload {
  if (!supplement) return primary;
  return {
    ...primary,
    isbn: primary.isbn || supplement.isbn,
    title: primary.title || supplement.title,
    author: primary.author || supplement.author,
    publisher: primary.publisher || supplement.publisher,
    publishedYear: primary.publishedYear ?? supplement.publishedYear,
    coverImageUrl: primary.coverImageUrl || supplement.coverImageUrl,
    description: primary.description || supplement.description,
  };
}

function buildLookupNotice(attempts: LookupAttempt[], missingFields: string[]): string {
  const hitLabels = attempts
    .filter((attempt) => attempt.status === "hit")
    .map((attempt) => SOURCE_LABELS[attempt.source]);
  const skippedLabels = attempts
    .filter((attempt) => attempt.status === "skipped_no_key")
    .map((attempt) => {
      const label = SOURCE_LABELS[attempt.source];
      return attempt.detail ? `${label}(${attempt.detail})` : label;
    });
  const missLabels = attempts
    .filter((attempt) => attempt.status === "miss")
    .map((attempt) => SOURCE_LABELS[attempt.source]);
  const errorLabels = attempts
    .filter((attempt) => attempt.status === "error")
    .map((attempt) => SOURCE_LABELS[attempt.source]);

  const parts: string[] = [];
  if (hitLabels.length > 0) parts.push(`조회 소스: ${hitLabels.join(", ")}`);
  if (skippedLabels.length > 0)
    parts.push(`키 미설정으로 제외: ${skippedLabels.join(", ")}`);
  if (missLabels.length > 0) parts.push(`데이터 없음: ${missLabels.join(", ")}`);
  if (errorLabels.length > 0) parts.push(`조회 오류: ${errorLabels.join(", ")}`);
  if (missingFields.length > 0) parts.push(`미수집 필드: ${missingFields.join(", ")}`);

  return parts.join(" | ");
}

async function runLookupAttempt(
  source: LookupSource,
  enabled: boolean,
  lookup: () => Promise<BookLookupPayload | null>,
  options?: LookupSkipDetails
): Promise<LookupAttempt> {
  if (!enabled) {
    return {
      source,
      status: "skipped_no_key",
      book: null,
      detail: options?.detail,
    };
  }
  try {
    const book = await lookup();
    return {
      source,
      status: book ? "hit" : "miss",
      book: book ?? null,
    };
  } catch (error) {
    return {
      source,
      status: "error",
      book: null,
      detail: error instanceof Error ? error.message : "unknown error",
    };
  }
}

function readEnvValue(keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

function getNaverCredentials(): {
  clientId: string | null;
  clientSecret: string | null;
  missing: string[];
} {
  const clientId = readEnvValue(NAVER_CLIENT_ID_ENV_KEYS);
  const clientSecret = readEnvValue(NAVER_CLIENT_SECRET_ENV_KEYS);

  const missing: string[] = [];
  if (!clientId) missing.push(NAVER_CLIENT_ID_ENV_KEYS.join(" 또는 "));
  if (!clientSecret) missing.push(NAVER_CLIENT_SECRET_ENV_KEYS.join(" 또는 "));

  return { clientId, clientSecret, missing };
}

function getSingleKeyPresence(keys: readonly string[]): {
  enabled: boolean;
  missing: string[];
} {
  const value = readEnvValue(keys);
  return {
    enabled: Boolean(value),
    missing: value ? [] : [keys.join(" 또는 ")],
  };
}

async function lookupByData4Library(isbn: string): Promise<BookLookupPayload | null> {
  const authKey = process.env.DATA4LIBRARY_AUTH_KEY?.trim();
  if (!authKey) return null;

  const url = new URL("https://data4library.kr/api/srchDtlList");
  url.searchParams.set("authKey", authKey);
  url.searchParams.set("isbn13", isbn);
  url.searchParams.set("loaninfoYN", "N");
  url.searchParams.set("displayInfo", "N");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as
    | {
        response?: {
          detail?: Array<{
            book?: {
              bookname?: string | null;
              authors?: string | null;
              publisher?: string | null;
              publication_year?: string | null;
              isbn13?: string | null;
              bookImageURL?: string | null;
            };
          }>;
        };
      }
    | null;

  const book = json?.response?.detail?.[0]?.book;
  if (!book?.bookname) return null;

  return {
    isbn: normalizeIsbn(book.isbn13 || isbn),
    title: normalizeText(book.bookname),
    author: normalizeText(book.authors),
    publisher: normalizeText(book.publisher),
    publishedYear: parseYear(book.publication_year),
    coverImageUrl: normalizeText(book.bookImageURL),
    description: null,
    source: "data4library",
  };
}

async function lookupByNationalLibrary(isbn: string): Promise<BookLookupPayload | null> {
  const certKey = process.env.NATIONAL_LIBRARY_CERT_KEY?.trim();
  if (!certKey) return null;

  const url = new URL("https://www.nl.go.kr/seoji/SearchApi.do");
  url.searchParams.set("cert_key", certKey);
  url.searchParams.set("result_style", "json");
  url.searchParams.set("page_no", "1");
  url.searchParams.set("page_size", "10");
  url.searchParams.set("isbn", isbn);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as unknown;
  const record = findNationalLibraryRecord(json);
  if (!record) return null;

  const title = getCaseInsensitiveField(record, [
    "TITLE",
    "TITLE_INFO",
    "title",
    "BOOKNAME",
    "bookname",
  ]);
  const author = getCaseInsensitiveField(record, ["AUTHOR", "author", "authors"]);
  const publisher = getCaseInsensitiveField(record, ["PUBLISHER", "publisher"]);
  const publicationDate = getCaseInsensitiveField(record, [
    "PUBLISH_PREDATE",
    "PUBLISH_DATE",
    "PUB_DATE",
    "publication_year",
    "publish_date",
  ]);
  const isbnRaw = getCaseInsensitiveField(record, [
    "EA_ISBN",
    "SET_ISBN",
    "ISBN13",
    "ISBN",
    "isbn",
  ]);
  const normalized = isbnRaw ? normalizeIsbn(isbnRaw) : isbn;

  if (!title && !author && !publisher) return null;

  return {
    isbn: normalized,
    title: normalizeText(title),
    author: normalizeText(author),
    publisher: normalizeText(publisher),
    publishedYear: parseYear(publicationDate),
    coverImageUrl: null,
    description: null,
    source: "nationallibrary",
  };
}

async function lookupByOpenLibrary(isbn: string): Promise<BookLookupPayload | null> {
  const res = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as
    | {
        title?: string;
        publish_date?: string;
        description?: string | { value?: string | null };
        publishers?: Array<string | { name?: string }>;
        authors?: Array<{ key?: string }>;
      }
    | null;

  if (!json?.title) return null;

  let author: string | null = null;
  const authorKey = json.authors?.[0]?.key;
  if (authorKey) {
    const authorRes = await fetch(`https://openlibrary.org${authorKey}.json`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (authorRes.ok) {
      const authorJson = (await authorRes.json().catch(() => null)) as
        | { name?: string | null }
        | null;
      author = authorJson?.name?.trim() || null;
    }
  }

  const publisherValue = json.publishers?.[0];
  const publisher =
    typeof publisherValue === "string"
      ? publisherValue
      : publisherValue && typeof publisherValue === "object"
      ? publisherValue.name || null
      : null;

  return {
    isbn,
    title: normalizeText(json.title),
    author,
    publisher: normalizeText(publisher),
    publishedYear: parseYear(json.publish_date),
    coverImageUrl: `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg`,
    description: normalizeDescription(json.description),
    source: "openlibrary",
  };
}

async function lookupByGoogleBooks(isbn: string): Promise<BookLookupPayload | null> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as
    | {
        items?: Array<{
          volumeInfo?: {
            title?: string;
            authors?: string[];
            publisher?: string;
            publishedDate?: string;
            description?: string;
            imageLinks?: {
              thumbnail?: string;
              smallThumbnail?: string;
            };
            industryIdentifiers?: Array<{
              type?: string;
              identifier?: string;
            }>;
          };
        }>;
      }
    | null;

  const volumeInfo = json?.items?.[0]?.volumeInfo;
  if (!volumeInfo?.title) return null;

  const isbn13 =
    volumeInfo.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier ?? isbn;
  const coverRaw = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || null;
  const coverImageUrl = coverRaw ? coverRaw.replace(/^http:\/\//i, "https://") : null;

  return {
    isbn: normalizeIsbn(isbn13),
    title: normalizeText(volumeInfo.title),
    author: normalizeText(volumeInfo.authors?.join(", ")),
    publisher: normalizeText(volumeInfo.publisher),
    publishedYear: parseYear(volumeInfo.publishedDate),
    coverImageUrl,
    description: normalizeText(volumeInfo.description),
    source: "googlebooks",
  };
}

async function lookupByNaverBook(isbn: string): Promise<BookLookupPayload | null> {
  const { clientId, clientSecret } = getNaverCredentials();
  if (!clientId || !clientSecret) return null;

  const url = new URL("https://openapi.naver.com/v1/search/book_adv.json");
  url.searchParams.set("d_isbn", isbn);
  url.searchParams.set("display", "1");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as
    | {
        items?: Array<{
          title?: string;
          author?: string;
          publisher?: string;
          pubdate?: string;
          isbn?: string;
          image?: string;
          description?: string;
        }>;
      }
    | null;

  const item = json?.items?.[0];
  if (!item?.title) return null;

  const normalizedTitle = normalizeText(decodeHtmlEntities(stripHtmlTags(item.title)));
  const normalizedAuthor = normalizeText(decodeHtmlEntities(stripHtmlTags(item.author ?? "")));
  const normalizedPublisher = normalizeText(
    decodeHtmlEntities(stripHtmlTags(item.publisher ?? ""))
  );
  const normalizedDescription = normalizeText(
    decodeHtmlEntities(stripHtmlTags(item.description ?? ""))
  );

  const isbnCandidates = (item.isbn ?? "")
    .split(" ")
    .map((value) => normalizeIsbn(value))
    .filter((value) => value.length === 13 || value.length === 10);
  const isbn13 = isbnCandidates.find((value) => value.length === 13) ?? isbnCandidates[0] ?? isbn;

  return {
    isbn: isbn13,
    title: normalizedTitle,
    author: normalizedAuthor,
    publisher: normalizedPublisher,
    publishedYear: parseYear(item.pubdate),
    coverImageUrl: normalizeText(item.image ?? null),
    description: normalizedDescription,
    source: "naverbook",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("isbn")?.trim();

  if (!raw) {
    return NextResponse.json(
      { ok: false, message: "isbn 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const isbn = normalizeIsbn(raw);
  if (!(isbn.length === 10 || isbn.length === 13)) {
    return NextResponse.json(
      { ok: false, message: "ISBN 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  try {
    const data4LibraryKey = getSingleKeyPresence(DATA4LIBRARY_ENV_KEYS);
    const nationalLibraryKey = getSingleKeyPresence(NATIONAL_LIBRARY_ENV_KEYS);
    const naverCredentials = getNaverCredentials();

    const attempts = await Promise.all([
      runLookupAttempt(
        "data4library",
        data4LibraryKey.enabled,
        () => lookupByData4Library(isbn),
        data4LibraryKey.missing.length > 0
          ? { detail: `키 누락: ${data4LibraryKey.missing.join(", ")}` }
          : undefined
      ),
      runLookupAttempt(
        "nationallibrary",
        nationalLibraryKey.enabled,
        () => lookupByNationalLibrary(isbn),
        nationalLibraryKey.missing.length > 0
          ? { detail: `키 누락: ${nationalLibraryKey.missing.join(", ")}` }
          : undefined
      ),
      runLookupAttempt(
        "naverbook",
        Boolean(naverCredentials.clientId && naverCredentials.clientSecret),
        () => lookupByNaverBook(isbn),
        naverCredentials.missing.length > 0
          ? { detail: `키 누락: ${naverCredentials.missing.join(", ")}` }
          : undefined
      ),
      runLookupAttempt("openlibrary", true, () => lookupByOpenLibrary(isbn)),
      runLookupAttempt("googlebooks", true, () => lookupByGoogleBooks(isbn)),
    ]);

    const bySource = new Map<LookupSource, LookupAttempt>();
    attempts.forEach((attempt) => {
      bySource.set(attempt.source, attempt);
    });

    const preferredOrder: LookupSource[] = [
      "data4library",
      "nationallibrary",
      "naverbook",
      "openlibrary",
      "googlebooks",
    ];

    const primary =
      preferredOrder
        .map((source) => bySource.get(source)?.book ?? null)
        .find((book): book is BookLookupPayload => Boolean(book)) ?? null;

    if (primary) {
      const mergedBook = preferredOrder.reduce((acc, source) => {
        const supplement = bySource.get(source)?.book ?? null;
        return mergeBookPayload(acc, supplement);
      }, primary);

      const missingFields: string[] = [];
      if (!mergedBook.publisher) missingFields.push("출판사");
      if (!mergedBook.coverImageUrl) missingFields.push("표지 이미지");
      if (!mergedBook.description) missingFields.push("도서 설명");

      const notice = buildLookupNotice(attempts, missingFields);
      return NextResponse.json({
        ok: true,
        book: mergedBook,
        meta: {
          notice,
          missingFields,
          attempts: attempts.map(({ source, status, detail }) => ({
            source,
            status,
            detail: detail ?? null,
          })),
        },
      });
    }

    const notice = buildLookupNotice(attempts, []);
    return NextResponse.json(
      {
        ok: false,
        message: notice
          ? `도서 정보를 찾지 못했습니다. ${notice}`
          : "도서 정보를 찾지 못했습니다.",
        meta: {
          attempts: attempts.map(({ source, status, detail }) => ({
            source,
            status,
            detail: detail ?? null,
          })),
        },
      },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? `도서 정보 조회 실패: ${error.message}` : "도서 정보 조회 실패",
      },
      { status: 500 }
    );
  }
}
