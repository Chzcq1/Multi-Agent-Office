import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import tasksRouter from "./tasks";
import discussionsRouter from "./discussions";
import summariesRouter from "./summaries";
import geminiRouter from "./gemini";
import profileRouter from "./profile";
import creditsRouter from "./credits";

const router: IRouter = Router();

router.use(profileRouter);
router.use(healthRouter);
router.use(agentsRouter);
router.use(tasksRouter);
router.use(discussionsRouter);
router.use(summariesRouter);
router.use(geminiRouter);
router.use(creditsRouter);

export default router;
