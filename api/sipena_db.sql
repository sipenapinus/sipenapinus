-- Skema Database SIPENA Pinus (MySQL)
-- Dirancang untuk mendukung sinkronisasi offline-first dari SIPENA Lite

CREATE DATABASE IF NOT EXISTS `sipena_lite_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `sipena_lite_db`;

-- 1. Table meta
CREATE TABLE IF NOT EXISTS `meta` (
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB;

-- 2. Table users
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `nama_lengkap` VARCHAR(255) NOT NULL,
  `nip` VARCHAR(100) DEFAULT NULL,
  `scope` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'aktif',
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 3. Table bkph
CREATE TABLE IF NOT EXISTS `bkph` (
  `id` VARCHAR(50) NOT NULL,
  `kode_bkph` VARCHAR(50) NOT NULL UNIQUE,
  `nama_bkph` VARCHAR(100) NOT NULL,
  `telepon` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'aktif',
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 4. Table rph
CREATE TABLE IF NOT EXISTS `rph` (
  `id` VARCHAR(50) NOT NULL,
  `bkph_id` VARCHAR(50) NOT NULL,
  `kode` VARCHAR(50) NOT NULL,
  `nama` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'aktif',
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 5. Table tpg
CREATE TABLE IF NOT EXISTS `tpg` (
  `id` VARCHAR(50) NOT NULL,
  `rph_id` VARCHAR(50) NOT NULL,
  `kode` VARCHAR(50) NOT NULL,
  `nama` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'aktif',
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 6. Table petak
CREATE TABLE IF NOT EXISTS `petak` (
  `id` VARCHAR(50) NOT NULL,
  `rph_id` VARCHAR(50) NOT NULL,
  `nomor` VARCHAR(50) NOT NULL,
  `luas_ha` DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  `jumlah_pohon` INT NOT NULL DEFAULT 0,
  `kelas_hutan` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'aktif',
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 7. Table anak_petak
CREATE TABLE IF NOT EXISTS `anak_petak` (
  `id` VARCHAR(50) NOT NULL,
  `petak_id` VARCHAR(50) NOT NULL,
  `tpg_id` VARCHAR(50) DEFAULT NULL,
  `huruf` VARCHAR(10) NOT NULL,
  `luas_ha` DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  `jumlah_pohon` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'aktif',
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 8. Table penyadap_master
CREATE TABLE IF NOT EXISTS `penyadap_master` (
  `id` VARCHAR(50) NOT NULL,
  `nomor` VARCHAR(50) NOT NULL,
  `nama` VARCHAR(255) NOT NULL,
  `alamat` TEXT DEFAULT NULL,
  `no_hp` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'aktif',
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 9. Table penugasan
CREATE TABLE IF NOT EXISTS `penugasan` (
  `id` VARCHAR(50) NOT NULL,
  `penyadap_id` VARCHAR(50) NOT NULL,
  `anak_petak_id` VARCHAR(50) NOT NULL,
  `aktif` INT NOT NULL DEFAULT 1,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 10. Table target_bkph
CREATE TABLE IF NOT EXISTS `target_bkph` (
  `id` VARCHAR(50) NOT NULL,
  `tahun` INT NOT NULL,
  `target_kg` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 11. Table target_rph
CREATE TABLE IF NOT EXISTS `target_rph` (
  `id` VARCHAR(50) NOT NULL,
  `tahun` INT NOT NULL,
  `rph_id` VARCHAR(50) NOT NULL,
  `target_kg` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 12. Table target_tpg
CREATE TABLE IF NOT EXISTS `target_tpg` (
  `id` VARCHAR(50) NOT NULL,
  `tahun` INT NOT NULL,
  `tpg_id` VARCHAR(50) NOT NULL,
  `target_kg` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 13. Table target_mandor
CREATE TABLE IF NOT EXISTS `target_mandor` (
  `id` VARCHAR(50) NOT NULL,
  `tahun` INT NOT NULL,
  `mandor_id` VARCHAR(50) NOT NULL,
  `target_kg` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 14. Table target_penyadap
CREATE TABLE IF NOT EXISTS `target_penyadap` (
  `id` VARCHAR(50) NOT NULL,
  `tahun` INT NOT NULL,
  `penyadap_id` VARCHAR(50) NOT NULL,
  `anak_petak_id` VARCHAR(50) NOT NULL,
  `target_kg` INT NOT NULL DEFAULT 0,
  `luas_ha` DECIMAL(10,4) DEFAULT 0.0000,
  `pohon` INT DEFAULT 0,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 15. Table target_anak_petak
CREATE TABLE IF NOT EXISTS `target_anak_petak` (
  `id` VARCHAR(50) NOT NULL,
  `tahun` INT NOT NULL,
  `anak_petak_id` VARCHAR(50) NOT NULL,
  `target_kg` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 16. Table kehadiran
CREATE TABLE IF NOT EXISTS `kehadiran` (
  `id` VARCHAR(50) NOT NULL,
  `tanggal` VARCHAR(50) NOT NULL,
  `penyadap_id` VARCHAR(50) NOT NULL,
  `status` VARCHAR(100) NOT NULL,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 17. Table monitoring
CREATE TABLE IF NOT EXISTS `monitoring` (
  `id` VARCHAR(50) NOT NULL,
  `tanggal` VARCHAR(50) NOT NULL,
  `penyadap_id` VARCHAR(50) NOT NULL,
  `kategori` VARCHAR(100) NOT NULL,
  `catatan` TEXT DEFAULT NULL,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 18. Table ro
CREATE TABLE IF NOT EXISTS `ro` (
  `id` VARCHAR(50) NOT NULL,
  `tahun` INT NOT NULL,
  `bulan` INT NOT NULL,
  `periode` INT NOT NULL,
  `areal_id` VARCHAR(50) NOT NULL,
  `penyadap_id` VARCHAR(50) NOT NULL,
  `kesanggupan` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL,
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 19. Table realisasi
CREATE TABLE IF NOT EXISTS `realisasi` (
  `id` VARCHAR(50) NOT NULL,
  `tanggal` VARCHAR(50) NOT NULL,
  `penyadap_id` VARCHAR(50) NOT NULL,
  `tpg_id` VARCHAR(50) DEFAULT NULL,
  `berat_kotor` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `tare` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `berat_bersih` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `kualitas` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'lokal',
  `created_at` VARCHAR(50) NOT NULL,
  `updated_at` VARCHAR(50) NOT NULL,
  `deleted_at` VARCHAR(50) DEFAULT NULL,
  `created_by` VARCHAR(100) DEFAULT NULL,
  `updated_by` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
