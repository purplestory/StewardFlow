import { NextResponse } from "next/server";

type BookLookupPayload = {
  isbn: string;
  title: string | null;
  author: string | null;
  publisher: string | null;
  publishedYear: number | null;
  coverImageUrl: string | null;
  description: string | null;
  source: "data4library" | "openlibrary" | "googlebooks";
};

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
    const [fromData4Library, fromOpenLibrary, fromGoogleBooks] = await Promise.all([
      lookupByData4Library(isbn),
      lookupByOpenLibrary(isbn),
      lookupByGoogleBooks(isbn),
    ]);

    const primary = fromData4Library ?? fromOpenLibrary ?? fromGoogleBooks;
    if (primary) {
      const mergedWithOpen = mergeBookPayload(primary, fromOpenLibrary);
      const mergedBook = mergeBookPayload(mergedWithOpen, fromGoogleBooks);
      return NextResponse.json({ ok: true, book: mergedBook });
    }

    return NextResponse.json(
      { ok: false, message: "도서 정보를 찾지 못했습니다." },
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
