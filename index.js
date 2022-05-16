const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { request } = require('express');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// MiddleWare 
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.fsdbm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Token' });
        }
        console.log('decoded', decoded);
        req.decoded = decoded;
        next();
    });

}

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctor_portal').collection('service');
        const bookingCollection = client.db('doctor_portal').collection('booking');
        const userCollection = client.db('doctor_portal').collection('user');


        // All Users Related
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })


        app.get('/', (req, res) => {
            res.send('Hero meets hero ku')
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })

        // User Related 
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };

                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }

        });


        // User Related 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const option = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, option);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ result, token });
        });



        // Services Related 
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const service = await cursor.toArray();
            res.send(service);
        });


        app.get('/available', async (req, res) => {
            const date = req.query.date;

            // Get All Service 
            const services = await serviceCollection.find().toArray();


            // Get The Booking of That Day 
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            // For each service, find booking for that service
            services.forEach(service => {
                const servicesBooking = bookings.filter(booking => booking.treatment === service.name);
                const booked = servicesBooking.map(service => service.slot);
                const available = service.slots.filter(ser => !booked.includes(ser));
                service.slots = available;
            })

            res.send(services);

        })

        // Booking Related 

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                res.status(403).send({ message: 'Forbidden Access' });
            }
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        });
    }
    finally { }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Doctor!')
})

app.listen(port, () => {
    console.log(`Doctor app listening on port ${port}`)
})