CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `users_id` PRIMARY KEY(`id`),
  CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

CREATE TABLE IF NOT EXISTS `colaboradores` (
  `id` int AUTO_INCREMENT NOT NULL,
  `nome` varchar(100) NOT NULL,
  `senha` text NOT NULL,
  `funcao` enum('motorista','ajudante','admin') NOT NULL,
  `valorHora` decimal(5,2) NOT NULL,
  `isAdmin` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `colaboradores_id` PRIMARY KEY(`id`),
  CONSTRAINT `colaboradores_nome_unique` UNIQUE(`nome`)
);

CREATE TABLE IF NOT EXISTS `registrosHoras` (
  `id` int AUTO_INCREMENT NOT NULL,
  `colaboradorId` int NOT NULL,
  `data` timestamp NOT NULL,
  `horaEntrada` varchar(5) NOT NULL,
  `horaPausa` varchar(5),
  `horaSaida` varchar(5),
  `numeroTrabalhos` int NOT NULL DEFAULT 0,
  `horasTrabalhadas` varchar(10) NOT NULL,
  `valorTotal` varchar(10) NOT NULL,
  `sincronizadoSheets` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `registrosHoras_id` PRIMARY KEY(`id`)
);

INSERT INTO `colaboradores` (`nome`, `senha`, `funcao`, `valorHora`, `isAdmin`)
VALUES ('WANDERSON', '$2b$10$952/6QL3E.Dm2rIpdPaVuOP6kXPamcLBk.sRlbpEbrYfEOXK5Pjd.', 'admin', 0.00, 1)
ON DUPLICATE KEY UPDATE
  `senha` = VALUES(`senha`),
  `funcao` = VALUES(`funcao`),
  `valorHora` = VALUES(`valorHora`),
  `isAdmin` = VALUES(`isAdmin`);
