-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 07-11-2025 a las 06:21:10
-- Versión del servidor: 11.7.2-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `tracking`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `envios_tracking`
--

CREATE TABLE `envios_tracking` (
  `idenvio` varchar(36) NOT NULL,
  `tracking_number` varchar(64) NOT NULL,
  `estado` varchar(255) NOT NULL,
  `idmensaje_discord` varchar(30) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `envios_tracking`
--

INSERT INTO `envios_tracking` (`idenvio`, `tracking_number`, `estado`, `idmensaje_discord`, `created_at`, `updated_at`) VALUES
('40271e9e-8f33-4937-a69e-7075706baabd', 'PLA23K071005905M', 'EN ENTREGA', '1436221506018345044', '2025-11-07 05:11:30', '2025-11-07 05:11:30');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `envios_tracking`
--
ALTER TABLE `envios_tracking`
  ADD PRIMARY KEY (`idenvio`),
  ADD UNIQUE KEY `uq_tracking_number` (`tracking_number`),
  ADD KEY `idx_estado` (`estado`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
