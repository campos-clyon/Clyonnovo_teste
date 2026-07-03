CREATE TABLE `colaboradores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(100) NOT NULL,
	`senha` text NOT NULL,
	`funcao` enum('motorista','ajudante') NOT NULL,
	`valorHora` varchar(10) NOT NULL,
	`isAdmin` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `colaboradores_id` PRIMARY KEY(`id`),
	CONSTRAINT `colaboradores_nome_unique` UNIQUE(`nome`)
);
--> statement-breakpoint
CREATE TABLE `registrosHoras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`colaboradorId` int NOT NULL,
	`data` timestamp NOT NULL,
	`horaEntrada` varchar(5) NOT NULL,
	`horaPausa` varchar(5),
	`horaSaida` varchar(5) NOT NULL,
	`numeroTrabalhos` int NOT NULL DEFAULT 0,
	`horasTrabalhadas` varchar(10) NOT NULL,
	`valorTotal` varchar(10) NOT NULL,
	`sincronizadoSheets` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `registrosHoras_id` PRIMARY KEY(`id`)
);
