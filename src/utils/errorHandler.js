/**
 * Centralized helper to parse API errors into user-friendly messages.
 * Handles Fetch Response objects, standard Errors, and strings.
 */
export const parseApiError = async (error) => {
    console.error("[Technical Error Log]", error);

    // 1. Handle Fetch Response objects (thrown from service layer)
    if (error instanceof Response) {
        try {
            const data = await error.json();
            // Priority: API specific error -> API specific message -> HTTP Status Text
            return data.error || data.message || `Server Error ${error.status}: ${error.statusText}`;
        } catch (e) {
            return `Server Error ${error.status}: ${error.statusText || 'Koneksi bermasalah'}`;
        }
    }

    // 2. Handle standard Error objects
    if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            return "Gagal terhubung ke server. Pastikan backend aktif dan Anda terhubung ke jaringan.";
        }
        return error.message;
    }

    // 3. Handle string or other types
    return typeof error === 'string' ? error : "Terjadi kesalahan sistem yang tidak diketahui.";
};