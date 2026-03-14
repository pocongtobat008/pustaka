/**
 * Menangani error API dan mengembalikan pesan yang ramah pengguna dalam Bahasa Indonesia.
 */
export const handleApiError = async (error) => {
    console.error("[API Error Context]:", error);

    // 1. Jika error memiliki respons (Fetch API)
    if (error instanceof Response) {
        try {
            const data = await error.json();
            return data.error || data.message || `Terjadi kesalahan (Status: ${error.status})`;
        } catch {
            return `Kesalahan Server: ${error.statusText || error.status}`;
        }
    }

    // 2. Jika error adalah objek Error standar JavaScript
    if (error instanceof Error) {
        // Cek pesan error umum
        const msg = error.message.toLowerCase();

        if (msg.includes("failed to fetch") || msg.includes("network error")) {
            return "Gagal terhubung ke server. Periksa koneksi internet Anda.";
        }

        if (msg.includes("timeout")) {
            return "Permintaan waktu habis. Silakan coba lagi.";
        }

        return error.message;
    }

    // 3. Jika error adalah string
    if (typeof error === 'string') {
        return error;
    }

    // 4. Default fallback
    return "Terjadi kesalahan sistem yang tidak terduga.";
};
