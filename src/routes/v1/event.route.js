const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const eventValidation = require('../../validations/event.validation');
const eventController = require('../../controllers/event.controller');

const router = express.Router();

// Rota principal para envio de eventos
router.route('/send').post(validate(eventValidation.createEvent.body), eventController.createEvent);

// Rota para consulta de eventos
router.route('/').get(auth('getEvents'), validate(eventValidation.getEvents.query), eventController.getEvents);

// Rota para obter evento específico
router.route('/:eventId').get(auth('getEvents'), validate(eventValidation.getEvent.params), eventController.getEvent);

// Rota para domínio/produto específico
router.route('/domain/:domain').post(validate(eventValidation.createEvent.body), eventController.createEvent);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Gerenciamento de eventos do Facebook Conversions API
 */

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Criar e enviar um evento para o Facebook
 *     description: Registra e envia um evento para o Facebook Conversions API.
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event_name
 *             properties:
 *               event_name:
 *                 type: string
 *                 enum: [Purchase, Lead, CompleteRegistration, Subscribe, AddToCart, InitiateCheckout, ViewContent, Search, Contact]
 *               event_time:
 *                 type: integer
 *                 description: Timestamp Unix (em segundos)
 *               user_data:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   first_name:
 *                     type: string
 *                   last_name:
 *                     type: string
 *                   external_id:
 *                     type: string
 *                   ip_address:
 *                     type: string
 *                   user_agent:
 *                     type: string
 *               custom_data:
 *                 type: object
 *                 example:
 *                   currency: BRL
 *                   value: 123.45
 *                   content_name: "Produto XYZ"
 *     responses:
 *       "201":
 *         description: Evento criado e enviado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *
 *   get:
 *     summary: Obter eventos
 *     description: Listar eventos.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pixelId
 *         schema:
 *           type: string
 *         description: ID do pixel
 *       - in: query
 *         name: eventName
 *         schema:
 *           type: string
 *         description: Nome do evento
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, sent, failed]
 *         description: Status do evento
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: formato campo:ordem (exemplo "createdAt:desc")
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 10
 *         description: Quantidade de itens por página
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   example: 1
 *                 totalResults:
 *                   type: integer
 *                   example: 1
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Obter um evento por ID
 *     description: Buscar evento pelo ID.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do evento
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /events/domain/{domain}:
 *   post:
 *     summary: Criar evento para um domínio específico
 *     description: Envia um evento associado a um domínio/produto específico.
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome do domínio ou produto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EventInput'
 *     responses:
 *       "201":
 *         description: Evento criado e enviado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
