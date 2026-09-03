// ─────────────────────────────────────────────────────────────────────────────
// Mesin terjemahan otomatis id → en untuk teks UI yang belum memakai t().
// Diterapkan oleh <AutoTranslateLayer/> lewat DOM saat bahasa = English.
// Kamus frasa: longest-match dulu, kata per kata sebagai fallback.
// ─────────────────────────────────────────────────────────────────────────────

const ID2EN = {
  // ── Inti UI ──
  'buat': 'create', 'tambah': 'add', 'tambahkan': 'add', 'hapus': 'delete', 'menghapus': 'delete',
  'ubah': 'edit', 'edit': 'edit', 'lihat': 'view', 'melihat': 'view', 'simpan': 'save', 'menyimpan': 'save',
  'batal': 'cancel', 'tutup': 'close', 'keluar': 'logout', 'muat': 'load', 'memuat': 'loading',
  'cari': 'search', 'pencarian': 'search', 'filter': 'filter', 'pilih': 'select', 'memilih': 'select',
  'semua': 'all', 'lainnya': 'others', 'ya': 'yes', 'tidak': 'no', 'lanjut': 'continue', 'kembali': 'back',
  'kirim': 'send', 'mengirim': 'send', 'terima': 'receive', 'unduh': 'download', 'mengunduh': 'downloading',
  'unggah': 'upload', 'mengunggah': 'uploading', 'cetak': 'print', 'ekspor': 'export', 'impor': 'import',
  'terapkan': 'apply', 'konfirmasi': 'confirm', 'perbarui': 'update', 'memperbarui': 'update',
  'proses': 'process', 'memproses': 'processing', 'sedang': 'currently', 'selesai': 'done',
  'sukai': 'like', 'bagikan': 'share', 'berbagi': 'share', 'duplikat': 'duplicate', 'salin': 'copy',
  'tempel': 'paste', 'pindah': 'move', 'ganti': 'change', 'mengganti': 'replace', 'atur': 'arrange',
  'kelola': 'manage', 'pengaturan': 'settings', 'preferensi': 'preferences', 'profil': 'profile',
  'beranda': 'home', 'menu': 'menu', 'item': 'item', 'items': 'items', 'semua menu': 'all menus',
  'modul': 'module', 'grup': 'group', 'kategori': 'category', 'halaman': 'page', 'tab': 'tab',

  // ── Umum / frasa pendek ──
  'berhasil': 'successfully', 'sukses': 'success', 'gagal': 'failed', 'kesalahan': 'error',
  'peringatan': 'warning', 'catatan': 'notes', 'note': 'note', 'alasan': 'reason',  'keterangan': 'remarks',
  'pesan': 'message', 'status': 'status', 'aksi': 'action', 'tindakan': 'action', 'kondisi': 'condition',
  'akun': 'account', 'masuk': 'sign in', 'masuk rp': 'received rp', 'berubah': 'changed',
  'wajib': 'required', 'opsional': 'optional', 'diperlukan': 'required', 'mohon': 'please',
  'silakan': 'please', 'harap': 'please', 'pastikan': 'make sure', 'cek': 'check', 'periksa': 'check',
  'yakin': 'sure', 'ingin': 'want to', 'coba': 'try', 'dicoba': 'tried', 'lakukan': 'do', 'dilakukan': 'done',
  'silahkan': 'please', 'maksimal': 'maximum', 'minimal': 'minimum', 'otomatis': 'automatic',
  'default': 'default', 'bawaan': 'default', 'kosong': 'empty', 'penuh': 'full', 'sebagian': 'partial',
  'total': 'total', 'jumlah': 'count', 'sisa': 'remaining', 'selisih': 'difference', 'rata': 'average',
  'rata-rata': 'average', 'estimasi': 'estimate', 'taksiran': 'estimate', 'perkiraan': 'estimate',
  'peringkat': 'ranking', 'urutan': 'order', 'terbaru': 'latest', 'terlama': 'oldest', 'naik': 'ascending',
  'turun': 'descending', 'tertinggi': 'highest', 'terendah': 'lowest', 'terbesar': 'largest',
  'terkecil': 'smallest', 'banyak': 'many', 'sedikit': 'few', 'cepat': 'fast', 'lambat': 'slow',
  'penting': 'important', 'rahasia': 'confidential', 'pribadi': 'private', 'internal': 'internal',
  'eksternal': 'external', 'lokal': 'local', 'online': 'online', 'aktif': 'active', 'nonaktif': 'inactive',
  'mati': 'disabled', 'hidup': 'enabled', 'terbuka': 'open', 'tertutup': 'closed', 'terkunci': 'locked',
  'aman': 'secure', 'keamanan': 'security', 'privasi': 'privacy', 'diizinkan': 'allowed', 'dilarang': 'forbidden',
  'izin': 'permission', 'hak': 'rights', 'peran': 'role', 'level': 'level', 'tingkat': 'level',
  'pengguna': 'users', 'anggota': 'members', 'administrator': 'administrator', 'divisi': 'division',
  'departemen': 'department', 'bagian': 'section', 'tim': 'team', 'unit': 'unit', 'kantor': 'office',
  'pusat': 'head office', 'cabang': 'branch', 'perusahaan': 'company', 'organisasi': 'organization',
  'bisnis': 'business', 'transaksi': 'transaction', 'keuangan': 'finance', 'akuntansi': 'accounting',
  'kas': 'cash', 'bank': 'bank', 'rekening': 'account', 'anggaran': 'budget', 'pengeluaran': 'expense',
  'pemasukan': 'income', 'pendapatan': 'revenue', 'laba': 'profit', 'rugi': 'loss', 'modal': 'capital',
  'hutang': 'debt', 'piutang': 'receivable', 'kewajiban': 'liability', 'aset': 'asset', 'neraca': 'balance sheet',
  'jurnal': 'journal', 'dibukukan': 'booked', 'pembukuan': 'bookkeeping',  'mata uang': 'currency',
  'tunggakan': 'overdue', 'jatuh tempo': 'due date', 'pelunasan': 'settlement', 'pembayaran': 'payment',
  'uang masuk': 'money received', 'uang keluar2': 'money paid out', 'masuk uang': 'money in',
  'diunggah': 'uploaded', 'diunduh': 'downloaded', 'wajib diunggah': 'must be uploaded',
  'sama dengan': 'same as', 'tidak boleh lebih': 'must not exceed', 'lebih besar': 'greater',
  'lebih kecil': 'smaller', 'menunggu approve': 'pending approval', 'menunggu faktur': 'awaiting tax invoice',
  'menunggu update': 'awaiting update', 'selesai di-settle': 'settled',
  'cicilan': 'installment', 'angsuran': 'installment', 'denda': 'fine', 'bunga': 'interest', 'potongan': 'deduction',

  // ── Domain invoice / proforma / pajak ──
  'daftar': 'list', 'data': 'data', 'invoice': 'invoice', 'faktur': 'invoice', 'proforma': 'proforma',
  'pajak': 'tax', 'dealer': 'dealer', 'barang': 'items', 'jasa': 'services', 'stok': 'stock',
  'persediaan': 'inventory', 'gudang': 'warehouse', 'gudang2': 'warehouse', 'nomor': 'number',
  'nominal': 'amount', 'nilai': 'value', 'harga': 'price', 'harga satuan': 'unit price',  'kuantitas': 'quantity', 'jumlah item': 'item count', 'berat': 'weight', 'volume': 'volume', 'dimensi': 'dimension',
  'uang': 'money', 'uang keluar': 'money out', 'subtotal': 'subtotal',
  'diskon': 'discount', 'materai': 'stamp duty', 'ppn': 'VAT', 'pph': 'income tax', 'kurs': 'exchange rate',
  'biaya': 'cost', 'ongkos': 'cost', 'beban': 'expense', 'lain-lain': 'miscellaneous', 'lainnya2': 'other',
  'dibayar': 'paid', 'belum dibayar': 'unpaid', 'terbayar': 'paid', 'pembayaran diterima': 'payment received',
  'pelanggan': 'customer', 'pemasok': 'supplier', 'vendor': 'vendor', 'penjualan': 'sales', 'pembelian': 'purchase',
  'pesanan': 'order', 'pengiriman': 'delivery', 'penerimaan': 'receipt', 'barang masuk': 'incoming goods',
  'barang keluar': 'outgoing goods', 'surat jalan': 'delivery note', 'resi': 'receipt',
  'pengajuan': 'submission', 'persetujuan': 'approval', 'disetujui': 'approved', 'menyetujui': 'approve',
  'setuju': 'approve', 'tolak': 'reject', 'menolak': 'reject', 'ditolak': 'rejected', 'mengirim balik': 'send back',
  'dikembalikan': 'returned', 'dikirim': 'sent', 'dikirim balik': 'sent back', 'diajukan': 'submitted',
  'menunggu': 'pending', 'pending': 'pending', 'draft': 'draft', 'disimpan': 'saved', 'tersimpan': 'saved',
  'diproses': 'processed', 'diperbarui': 'updated', 'dihapus': 'deleted', 'diarsipkan': 'archived',
  'diarsip': 'archive', 'arsip': 'archive', 'dipindah': 'moved', 'dipulihkan': 'restored', 'dipulihkan2': 'recovered',
  'dibatalkan': 'cancelled', 'pembatalan': 'cancellation', 'batal2': 'void', 'revisi': 'revision',
  'pengganti': 'replacement', 'pelunasan dp': 'DP settlement', 'dp': 'down payment', 'down payment': 'down payment',
  'sisa tagihan': 'outstanding balance', 'tagihan': 'bill', 'tgl': 'date', 'tanggal': 'date',
  'nomor invoice': 'invoice number', 'nomor proforma': 'proforma number', 'nomor po': 'PO number',
  'nomor faktur': 'invoice number', 'no invoice': 'invoice no.', 'no po': 'PO no.', 'no proforma': 'proforma no.',
  'tenggat': 'deadline', 'berlaku': 'valid', 'kedaluwarsa': 'expired', 'masa berlaku': 'validity period',

  // ── Dokumen / AI / file ──
  'dokumen': 'documents', 'berkas': 'files', 'lampiran': 'attachment', 'lampiran2': 'attachments',
  'berkas2': 'file', 'folder': 'folder', 'direktori': 'directory', 'jenis': 'type', 'tipe': 'type',
  'ukuran': 'size', 'format': 'format', 'halaman2': 'pages', 'sampah': 'trash', 'sampah2': 'recycle bin',
  'pulihkan': 'restore', 'pulihkan2': 'restore', 'hapus permanen': 'delete permanently', 'permanen': 'permanent',
  'sementara': 'temporary', 'riwayat': 'history', 'log': 'log', 'jejak': 'trail', 'audit': 'audit',
  'laporan': 'report', 'ringkasan': 'summary', 'grafik': 'chart', 'diagram': 'chart', 'bagan': 'chart',
  'peta': 'map', 'denah': 'floor plan', 'notifikasi': 'notifications', 'kotak masuk': 'inbox',
  'tugas': 'task', 'pekerjaan': 'job', 'jadwal': 'schedule', 'kalender': 'calendar', 'cuti': 'leave',
  'izin2': 'permission', 'hadir': 'present', 'absensi': 'attendance', 'waktu': 'time', 'jam': 'hour',
  'menit': 'minute', 'detik': 'second', 'hari': 'day', 'minggu': 'week', 'bulan': 'month', 'tahun': 'year',
  'kuartal': 'quarter', 'semester': 'semester', 'periode': 'period', 'sekarang': 'now', 'hari ini': 'today',
  'kemarin': 'yesterday', 'besok': 'tomorrow', 'lalu': 'ago', 'selanjutnya': 'next', 'sebelumnya': 'previous',
  'tampilkan': 'show', 'sembunyikan': 'hide', 'tampil': 'shown', 'tersembunyi': 'hidden', 'buka2': 'open',
  'meluncurkan': 'launch', 'pratinjau': 'preview', 'pratinjau2': 'preview', 'contoh': 'sample',
  'template': 'template', 'pola': 'pattern', 'skema': 'schema', 'struktur': 'structure', 'kolom': 'column',
  'baris2': 'row', 'sel': 'cell', 'judul': 'title', 'deskripsi': 'description', 'kata kunci': 'keywords',
  'paragraf': 'paragraph', 'gambar': 'image', 'foto': 'photo', 'video': 'video', 'suara': 'audio',
  'teks': 'text', 'warna': 'color', 'latar': 'background', 'font': 'font', 'huruf': 'letter',
  'cetak2': 'printed', 'kertas': 'paper', 'ukuran kertas': 'paper size', 'margin': 'margin',
  'posisi': 'position', 'lokasi': 'location', 'arah': 'direction', 'kanan': 'right', 'kiri': 'left',
  'atas': 'top', 'bawah': 'bottom', 'tengah': 'center', 'samping': 'side', 'depan': 'front', 'belakang': 'back',
  'dekat': 'near', 'jauh': 'far', 'sejajar': 'aligned', 'rapi': 'neat', 'berantakan': 'messy',
  'jelas': 'clear', 'samar': 'blurry', 'terang': 'bright', 'gelap': 'dark', 'terang2': 'light',

  // ── AI ──
  'kecerdasan': 'intelligence', 'buatan': 'artificial', 'model': 'model', 'asisten': 'assistant',
  'obrolan': 'chat', 'kirim pesan': 'send message', 'tulis pesan': 'type a message', 'jawaban': 'answer',
  'pertanyaan': 'question', 'pikir': 'thinking', 'analisis': 'analysis', 'analisa': 'analysis',
  'pelatihan': 'training', 'melatih': 'train', 'dilatih': 'trained', 'terlatih': 'trained',
  'dokumen pintar': 'smart documents', 'pemindai': 'scanner', 'pindai': 'scan', 'memindai': 'scanning',
  'dipindai': 'scanned', 'hasil': 'result', 'hasil2': 'results', 'ekstrak': 'extract', 'ekstraksi': 'extraction',
  'diekstrak': 'extracted', 'dipetakan': 'mapped', 'pemetaan': 'mapping', 'bidang': 'field', 'label2': 'label',
  'deteksi': 'detection', 'mendeteksi': 'detect', 'terdeteksi': 'detected', 'pengenalan': 'recognition',
  'mengenali': 'recognize', 'dikenali': 'recognized', 'bahasa': 'language', 'terjemahan': 'translation',
  'menerjemahkan': 'translate', 'diterjemahkan': 'translated', 'suara2': 'voice', 'tanda tangan': 'signature',
  'menandatangani': 'sign', 'ttd': 'signature', 'paraf': 'initial', 'stempel': 'stamp', 'barcode': 'barcode',
  'qrcode': 'QR code', 'kerangka': 'framework', 'pengetahuan': 'knowledge', 'memori': 'memory',
  'semantik': 'semantic', 'graf': 'graph', 'simpul': 'node', 'hubungan': 'relationship', 'terhubung': 'connected',

  // ── Umum penuh kalimat pendek ──
  'tidak ada': 'no', 'belum ada': 'no', 'belum': 'not yet', 'ada': 'exists', 'tidak tersedia': 'unavailable',
  'tidak ditemukan': 'not found', 'tidak valid': 'invalid', 'tidak cocok': 'mismatch', 'tidak aktif': 'inactive',
  'belum diisi': 'not filled', 'sedang memuat': 'loading', 'memuat data': 'loading data',
  'gagal memuat': 'failed to load', 'gagal memuat data': 'failed to load data',
  'data berhasil disimpan': 'data saved successfully', 'data berhasil dihapus': 'data deleted successfully',
  'berhasil disimpan': 'saved successfully', 'berhasil dihapus': 'deleted successfully',
  'berhasil diperbarui': 'updated successfully', 'berhasil ditambahkan': 'added successfully',
  'berhasil dikirim': 'sent successfully', 'berhasil diunggah': 'uploaded successfully',
  'gagal menyimpan': 'failed to save', 'gagal menghapus': 'failed to delete', 'gagal mengirim': 'failed to send',
  'terjadi kesalahan': 'an error occurred', 'terjadi masalah': 'something went wrong',
  'ada masalah': 'there is a problem', 'periksa kembali': 'check again', 'coba lagi': 'try again',
  'silahkan coba lagi': 'please try again', 'mohon tunggu': 'please wait', 'harap tunggu': 'please wait',
  'sebentar lagi': 'in a moment', 'akan diarahkan': 'you will be redirected', 'kembali ke': 'back to',
  'pilih file': 'choose file', 'pilih file lampiran': 'choose attachment file', 'tidak ada file': 'no file',
  'tidak ada file dipilih': 'no file selected', 'file dipilih': 'files selected', 'hapus file': 'remove file',
  'lanjutkan': 'continue', 'batalkan': 'cancel', 'simpan perubahan': 'save changes', 'simpan dulu': 'save first',
  'keluar dari': 'sign out of', 'masuk ke': 'sign in to', 'login': 'sign in', 'daftar akun': 'create account',
  'lupa password': 'forgot password', 'kata sandi': 'password', 'nama pengguna': 'username',
  'nama lengkap': 'full name', 'nomor hp': 'phone number', 'nomor telepon': 'phone number',

  // ── Statistik / dashboard ──
  'indikator': 'indicator', 'kinerja': 'performance', 'pencapaian': 'achievement', 'target': 'target',
  'realisasi': 'realization', 'pertumbuhan': 'growth', 'perubahan': 'change', 'tren': 'trend',
  'sebaran': 'distribution', 'distribusi': 'distribution', 'perbandingan': 'comparison',
  'teratas': 'top', 'terbaik': 'best', 'teraktif': 'most active', 'terlaris': 'best seller',
  'paling sering': 'most frequent', 'total nominal': 'total amount', 'jumlah data': 'data count',
  'entri': 'entries', 'entry': 'entry', 'catatan2': 'record', 'rekam': 'record', 'direkam': 'recorded',
  'draft2': 'draft', 'konsep': 'concept', 'aktifitas': 'activity', 'kegiatan': 'activity', 'aktivitas': 'activity',
  'seluruh': 'entire', 'keseluruhan': 'overall', 'keseluruhan2': 'whole', 'gabungan': 'combined',
  'semua departemen': 'all departments', 'lintas': 'cross', 'departemen2': 'department',
  'izin akses': 'access permission', 'grup pengguna': 'user group', 'hak akses': 'access rights',
  'superadmin': 'super admin', 'manajer': 'manager', 'staff': 'staff', 'karyawan': 'employee',
  'diterbitkan': 'issued', 'terbit': 'published', 'tersedia': 'available', 'aktifkan': 'enable',
  'nonaktifkan': 'disable', 'mengaktifkan': 'enable', 'menonaktifkan': 'disable', 'diaktifkan': 'enabled',
  'menyalin': 'copy', 'digabung': 'merged', 'dikelompokkan': 'grouped', 'dipisahkan': 'separated',
  'pisahkan': 'separate', 'pemisah': 'separator', 'dipilih': 'selected', 'ditandai': 'marked',
  'tandai': 'mark', 'tandai2': 'flag', 'bertanda': 'flagged', 'simbol': 'symbol', 'ikon': 'icon',
  'logo': 'logo', 'header': 'header', 'footer': 'footer', 'kop': 'letterhead', 'kertas kop': 'letterhead',
  'paraf2': 'initial', 'inisial': 'initial', 'kota': 'city', 'provinsi': 'province', 'negara': 'country',
  'kode pos': 'postal code', 'kecamatan': 'district', 'kelurahan': 'subdistrict', 'jalan': 'street',
  'rt': 'RT', 'rw': 'RW', 'blok': 'block', 'nomor rumah': 'house number', 'patokan': 'landmark',
  'tenggat waktu': 'deadline', 'segera': 'soon', 'mendesak': 'urgent', 'kritis': 'critical', 'normal': 'normal',
  'rendah': 'low', 'sedang2': 'medium', 'tinggi': 'high', 'prioritas': 'priority', 'urutan prioritas': 'priority order',

  // ── Status & verba turunan umum (di-, me-) ──
  'diproses2': 'processed', 'diteruskan': 'forwarded', 'dialihkan': 'redirected', 'dijadwalkan': 'scheduled',
  'dimulai': 'started', 'mulai': 'start', 'berakhir': 'ended', 'akhiri': 'end', 'selesaikan': 'finish',
  'menyelesaikan': 'finishing', 'dilewati': 'skipped', 'lewati': 'skip', 'lewati2': 'skip',
  'diperlukan2': 'needed', 'membutuhkan': 'requires', 'butuh': 'need', 'memerlukan': 'requires',
  'bisa': 'can', 'dapat': 'can', 'mampu': 'able', 'sudah': 'already', 'sudah2': 'has been',
  'akan': 'will', 'harus': 'must', 'sebaiknya': 'should', 'baiknya': 'better', 'disarankan': 'recommended',
  'rekomendasi': 'recommendation', 'rekomendasikan': 'recommend', 'panduan': 'guide', 'instruksi': 'instructions',
  'manual': 'manual', 'panduan pengguna': 'user guide', 'bantuan': 'help', 'pusat bantuan': 'help center',
  'saran': 'suggestion', 'suggest': 'suggestions', 'masukan': 'input', 'feedback': 'feedback', 'ulasan': 'review',
  'penilaian': 'rating', 'nilai2': 'rating', 'skor': 'score', 'komentar': 'comment', 'diskusi': 'discussion',
  'forum': 'forum', 'komunitas': 'community', 'berita': 'news', 'pengumuman': 'announcement',
  'pembaruan': 'update', 'versi': 'version', 'rilis': 'release', 'terbaru2': 'latest',
  'detail': 'details', 'rincian': 'details', 'lengkap': 'complete', 'lengkapi': 'complete', 'lengkap2': 'full',
  'info': 'info', 'informasi': 'information', 'menginformasikan': 'inform', 'diberitahu': 'notified',
  'konfirmasi2': 'confirmation', 'memastikan': 'ensure', 'kejelasan': 'clarity', 'kepastian': 'certainty',

  // ── Search/empty/tabel ──
  'hasil pencarian': 'search results', 'tidak ada hasil': 'no results', 'tidak ada hasil ditemukan': 'no results found',
  'cari berdasarkan': 'search by', 'cari data': 'search data', 'cari nama': 'search name',
  'ketik': 'type', 'masukkan': 'enter', 'masukan2': 'input', 'input': 'input', 'isi': 'fill',
  'diisi': 'filled', 'contoh2': 'e.g.', 'contohnya': 'for example', 'misalnya': 'for example',
  'atau pilih': 'or choose', 'nama2': 'name', 'ditampilkan': 'displayed', 'menampilkan': 'showing',
  'per halaman': 'per page', 'dari total': 'of total', 'pagination': 'pagination',

  // angka ordinal / bantuan
  'pertama': 'first', 'kedua': 'second', 'ketiga': 'third', 'keempat': 'fourth', 'kelima': 'fifth',
  'terakhir': 'last', 'akhir': 'end', 'awal': 'beginning', 'tengah2': 'middle', 'sementara2': 'while',
  'selama': 'during', 'hingga': 'until', 'sampai': 'until', 'setelah': 'after', 'sebelum': 'before',
  'antara': 'between', 'bersama': 'together', 'tanpa': 'without', 'dalam': 'within', 'keluar dari2': 'out of',
  'masuk ke2': 'into', 'menuju': 'towards', 'kepada': 'to', 'karena': 'because', 'sehingga': 'therefore',
  'maka': 'then', 'selain': 'besides', 'termasuk': 'including', 'terkait': 'related', 'berkaitan': 'related to',
  'berdasarkan': 'based on', 'menurut': 'according to', 'sesuai': 'according to', 'cocok2': 'matches',
  'valid': 'valid', 'benar': 'correct', 'salah': 'wrong', 'kembar': 'duplicate', 'duplikat2': 'duplicate',
  'hampir': 'almost', 'sama': 'same', 'berbeda': 'different', 'beda': 'different', 'serupa': 'similar',
  'mendekati': 'close to', 'jauh2': 'far', 'sekitar': 'around', 'kurang lebih': 'approximately',

  // ── Gelombang 2: kata yang masih sering muncul ──
  'ajukan': 'submit', 'ajukan ulang': 'resubmit', 'aplikasi': 'application', 'asal': 'origin',
  'barangnya': 'the items', 'bawahnya': 'below it', 'bayar': 'pay', 'pembayaran2': 'payment',
  'berbagai': 'various', 'bergantung': 'depends', 'bersih': 'clean', 'campuran': 'mixture',
  'dahulu': 'first', 'dasar': 'basic', 'datamu': 'your data', 'diambil': 'taken', 'dibangun': 'built',
  'dibersihkan': 'cleaned', 'dicari': 'searched', 'dicek': 'checked', 'didukung': 'supported',
  'diedit': 'edited', 'dikonfigurasi': 'configured', 'dikoreksi': 'corrected', 'dilihat': 'viewed',
  'dilunasi': 'paid off', 'diperiksa': 'checked', 'dipertahankan': 'maintained', 'dipinjam': 'borrowed',
  'dipotong': 'deducted', 'disesuaikan': 'adjusted', 'ditambah': 'added', 'ditanyakan': 'asked',
  'diwariskan': 'inherited', 'dokumentasi': 'documentation', 'durasi': 'duration', 'gabung': 'merge',
  'geser': 'drag', 'hitung': 'calculate', 'menghitung': 'calculate', 'hubungi': 'contact',
  'jadi': 'become', 'jarak': 'distance', 'jika': 'if', 'juga': 'also', 'kalkulator': 'calculator',
  'khusus': 'special', 'komponen': 'component', 'kompres': 'compress', 'kompresi': 'compression',
  'kursor': 'cursor', 'kustomisasi': 'customization', 'kustom': 'custom', 'lebar': 'width',
  'lepas': 'release', 'lewat': 'via', 'lingkungan': 'environment', 'macet': 'stuck', 'mana': 'which',
  'manajemen': 'management', 'matikan': 'disable', 'membaca': 'read', 'membangun': 'build',
  'membatalkan': 'cancel', 'membatasi': 'limit', 'memulai': 'start', 'menandai': 'mark',
  'mengarsipkan': 'archive', 'mengatur': 'manage', 'mengekstrak': 'extract', 'mengelola': 'manage',
  'mengelompokkan': 'group', 'menghadapi': 'face', 'mengisi': 'fill', 'mengonversi': 'convert',
  'mengoreksi': 'correct', 'menjelajah': 'browse', 'mentah': 'raw', 'menyesuaikan': 'adjust',
  'mesin': 'machine', 'miring': 'italic', 'namun': 'however', 'opsi': 'option', 'orientasi': 'orientation',
  'parsial': 'partial', 'pecah': 'split', 'pegawai': 'employee', 'pelaporan': 'reporting',
  'pembetulan': 'correction', 'pembulatan': 'rounding', 'pemeriksaan': 'inspection', 'pemicu': 'trigger',
  'penerapan': 'implementation', 'pengenaan': 'imposition', 'penghapusan': 'deletion',
  'pengirim': 'sender', 'penjelasan': 'explanation', 'penjumlahan': 'total', 'penyimpanan': 'storage',
  'perbaiki': 'fix', 'perkembangan': 'progress', 'pernah': 'ever', 'perpajakan': 'taxation',
  'persentase': 'percentage', 'pertambahan': 'increase', 'pihak': 'party', 'proteksi': 'protection',
  'prosedur': 'procedure', 'langkah': 'step', 'lanjutan': 'advanced', 'lapis': 'layer',
  'keinginan': 'desire', 'kendala': 'obstacle', 'ketersediaan': 'availability',
  'keberlangsungan': 'continuity', 'kurangnya': 'lack of', 'fondasi': 'foundation', 'netto': 'net',
  'aktiva': 'assets', 'pasiva': 'liabilities', 'setara': 'equivalent', 'tunai': 'cash', 'periode2': 'period',
  'tunggakan2': 'outstanding', 'arus kas': 'cash flow', 'laba rugi': 'profit & loss',
  'pengeluaran2': 'expense', 'penerimaan2': 'income', 'penyesuaian': 'adjustment', 'akrual': 'accrual',
  'disusutkan': 'depreciated', 'penyusutan': 'depreciation', 'revaluasi': 'revaluation', 'cadangan': 'reserve',

  // ── Kalimat deskripsi yang sering muncul (agar hasil utuh, bukan campur) ──
  'template (jenis dokumen)': 'Template (Document Type)',
  'template dipakai bersama, tetapi hasil ekstraksi, arsip & export hanya terlihat oleh pembuatnya (admin melihat semua)':
      'Templates are shared, but extraction results, archives & exports are only visible to their creator (admins can view all)',
  'template aktif akan dipakai untuk export pdf proforma invoice':
      'The active template will be used to export the Proforma Invoice PDF.',
  'gulir untuk melihat semua': 'scroll to view all',
  'ditandatangani': 'signed', 'tanda tangani': 'sign', 'kotak merah': 'red box',
  'menyimpan konfigurasi template untuk dipakai ulang': 'Save the template configuration to be reused.',
  'konfigurasi dapat dipakai ulang, tidak dibuat dari nol': 'The configuration can be reused — it is not built from scratch.',
  'desain dapat dipakai ulang, tidak dibuat ulang per dokumen': 'The design can be reused instead of being rebuilt for every document.',
  'mempercepat pembuatan variasi template': 'Speeds up creating template variations.',
};

// Peta lookup lowercase → translation (value disimpan persis untuk matchCase)
const EN_BY_ID = Object.create(null);
for (const [id, en] of Object.entries(ID2EN)) {
  EN_BY_ID[id.toLowerCase()] = en;
}
const PHRASES = Object.keys(EN_BY_ID).sort((a, b) => b.length - a.length);
const LETTER = /[A-Za-z\u00C0-\u024F]/;

function matchCase(original, translation) {
  if (!original || !translation) return translation;
  const first = original[0];
  let out = translation;
  if (/[A-Z]/.test(first)) {
    if (original.length >= 2 && original === original.toUpperCase()) out = out.toUpperCase();
    else out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  // normalisasi mata uang "rp" -> "Rp"
  if (/\brp\b/i.test(out)) out = out.replace(/(^|\s)rp(?=\s|$)/gi, '$1Rp');
  return out;
}

/** Terjemahkan teks Indonesia → Inggris (panjang frasa diutamakan). */
export function translateIdToEn(input) {
  if (!input || typeof input !== 'string') return input;
  let out = '';
  let i = 0;
  const len = input.length;
  while (i < len) {
    const ch = input[i];
    if (!LETTER.test(ch)) { out += ch; i += 1; continue; }
    let matched = false;
    const rest = input.slice(i);
    const restLower = rest.toLowerCase();
    for (const phrase of PHRASES) {
      if (!restLower.startsWith(phrase)) continue;
      const end = i + phrase.length;
      const beforeOk = i === 0 || !LETTER.test(input[i - 1]);
      const afterOk = end >= len || !LETTER.test(input[end]);
      if (!beforeOk || !afterOk) continue;
      out += matchCase(input.slice(i, end), EN_BY_ID[phrase]);
      i = end;
      matched = true;
      break;
    }
    if (!matched) { out += ch; i += 1; }
  }
  return out;
}

// Cek cepat apakah teks mengandung kata Indonesia (hindari proses teks EN murni)
const INDO_WORD_STEMS = new Set(Object.keys(ID2EN).flatMap((p) => p.toLowerCase().split(' ')));
const WORD_SPLIT = /[^a-z\u00C0-\u024F]+/;

export function containsIndonesian(text) {
  if (!text || text.length > 4000) return false;
  const toks = text.toLowerCase().split(WORD_SPLIT);
  for (const tk of toks) if (tk.length > 1 && INDO_WORD_STEMS.has(tk)) return true;
  return false;
}
