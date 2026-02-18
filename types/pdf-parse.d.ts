declare module 'pdf-parse' {
    interface PDFInfo {
        PDFFormatVersion?: string;
        IsAcroFormPresent?: boolean;
        IsXFAPresent?: boolean;
        Title?: string;
        Author?: string;
        Subject?: string;
        Keywords?: string;
        Creator?: string;
        Producer?: string;
        CreationDate?: string;
        ModDate?: string;
    }

    interface PDFData {
        numpages: number;
        numrender: number;
        info: PDFInfo;
        metadata: unknown;
        version: string;
        text: string;
    }

    interface PDFOptions {
        pagerender?: (pageData: unknown) => string;
        max?: number;
        version?: string;
    }

    function pdf(dataBuffer: Buffer, options?: PDFOptions): Promise<PDFData>;

    export = pdf;
}
