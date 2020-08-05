const logger = require('gfs-logging').createLogger()
const metrics = require('gfs-metrics').default

/* Create a middleware we can use to add the logger and metrics to routes and
   other middlewares that might need it */
const observableMiddleware = (req, res, next) => {
    req.context = { ...req.context, logger, metrics }
    next()
}

/* A really simple data access object, and some data */
const jobs = ['Do something', 'Do something else']

const jobsProvider = {
    get: () => jobs,
    add: (job) => jobs.push(job)
}

/* Create a middleware we can use to 'inject' the data access object into
   routes where it's needed */
const jobsMiddleware = (req, res, next) => {
    req.context = { ...req.context, jobsProvider }
    next()
}

/* Add the logger and metrics middleware to every route and middleware we subsequently define */
const app = require('express')()
app.use(observableMiddleware)

/* The root path has access to the logger and metrics, but not the data access
   object */
app.get('/', (req, res) => {
    req.context = {...req.context, logger, metrics}

    logger.info('Root was called')
    metrics.increment('root_calls')

    res.status(200).send('ok')
})

/* Now create a router to handle jobs. It needs the body-parser middleware, and the data access
   middleware too */
const jobRouter = require('express').Router()
jobRouter.use(require('body-parser').json())
jobRouter.use(jobsMiddleware)

/* Note how the route has the data access object in it's request now */
jobRouter.get('/', (req, res) => res.status(200).send(req.context.jobsProvider.get()))

/* The route also has the logger and metrics too */
jobRouter.post('/', (req, res) => {
    const {jobsProvider, logger, metrics} = req.context
    jobsProvider.add(req.body.job)
    metrics.increment('jobs')
    logger.info(`Add job ${req.body.job}`)
    res.status(201).send(jobsProvider.get())
})
app.use('/jobs', jobRouter)

app.listen(9000, () => {
    logger.info('App is running')
    metrics.event('cold_start')
})