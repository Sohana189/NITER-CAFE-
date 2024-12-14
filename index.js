const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
const app = express()
require("dotenv").config();
const stripe = require('stripe')(process.env.Stripe_Secret)

//middle ware

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Welcome to Online Resturant Server !!')
})



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ohovmgv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const menu = client.db('FoodDB').collection('menu');
    const reviews = client.db('FoodDB').collection('review')
    const carts = client.db('FoodDB').collection('carts')
    const users = client.db('FoodDB').collection('users')
    const payments = client.db('FoodDB').collection('paymentHistory')
    const bookings = client.db('FoodDB').collection('bookingCollections')
    const feedbacks = client.db('FoodDB').collection('feedbacks')

    //menu

    app.get('/menu', async (req, res) => {
      const result = await menu.find().toArray();
      res.send(result);
    })

    // Post menu 
    app.post('/menu', async (req, res) => {
      const menuItems = req.body;
      const result = await menu.insertOne(menuItems);
      res.send(result)
    })

    app.delete('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menu.deleteOne(query);
      res.send(result)
    })

    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menu.findOne(query);
      res.send(result)
    })

    app.patch('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const items = req.body;
      const updateDoc = {
        $set: {
          name: items.name,
          category: items.category,
          recipe: items.recipe,
          price: items.price,
          image: items.image
        }
      }
      const result = await menu.updateOne(query, updateDoc)
      res.send(result)
    })

    //reviews

    app.get('/review', async (req, res) => {
      const result = await reviews.find().toArray();
      res.send(result)
    })

    app.post('/review', async(req, res)=>{
      const doc = req.body;
      const result = await reviews.insertOne(doc)
      res.send(result)
    })

    //My carts 

    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { useremail: email }
      const result = await carts.find(query).toArray();
      res.send(result)
    })

    app.post('/carts', async (req, res) => {
      const items = req.body;
      const result = await carts.insertOne(items);
      res.send(result)
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await carts.deleteOne(query);
      res.send(result)
    })


    // for users to see admins 

    app.get('/users', async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const userInfo = req.body;
      //ignoring users if he already exists
      const query = { email: userInfo.email }
      const existing = await users.findOne(query);
      if (existing) {
        return res.send({ message: 'User Already Exits', insertedId: null })
      }
      const result = await users.insertOne(userInfo);
      res.send(result)
    })

    app.patch('/users', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const body = req.body;
      const updateDoc = {
        $set: {
          image: body.image
        }
      }
      const result = await users.updateOne(query, updateDoc)
      res.send(result)
    })

    app.get('/users/email', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await users.find(query).toArray();
      res.send(result)
    })

    //make admin

    app.patch('/users/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await users.updateOne(filter, updateDoc)
      res.send(result)
    })

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await users.deleteOne(query);
      res.send(result)

    })

    // verify admin or not 

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await users.findOne(query)
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin })
    })

    //payment Intent

    app.post('/create-payment', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100)
      console.log(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    app.get('/payments/:email', async (req, res) => {
      const query = { email: req.params.email }
      const result = await payments.find(query).toArray();
      res.send(result)
    })


    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentRes = await payments.insertOne(payment);
      console.log('payment Info', payment)
      //delete Payed items 

      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      }
      const deleteRes = await carts.deleteMany(query)

      res.send({ paymentRes, deleteRes })
    })
    //admin  analysis

    app.get('/admin-stats', async (req, res) => {
      const user = await users.estimatedDocumentCount();
      const menuItems = await menu.estimatedDocumentCount();
      const order = await payments.estimatedDocumentCount();
      // const payment = await payments.find().toArray();
      // const revenue = payment.reduce((total , item)=>total + item.price ,0)

      const result = await payments.aggregate([
        {
          $group: {
            _id: null,
            revenue: { $sum: '$price' }
          }
        }
      ]).toArray()

      const revenue = result.length > 0 ? result[0].revenue : 0;


      res.send({
        user, menuItems, order, revenue
      })
    })
    
    //Bookings
    
    app.get('/booking', async(req , res)=>{
      const result = await bookings.find().toArray();
      res.send(result)
    })

    app.post('/booking', async(req , res)=>{
      const doc = req.body;
      const result = await bookings.insertOne(doc);
      res.send(result)
    })

    app.patch('/booking/:id', async(req , res)=>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const doc = req.body;
      const updateDoc ={
        $set:{
          status : doc.status
        }
      }
      const result = await bookings.updateOne(query, updateDoc)
      res.send(result)

    })

    app.delete('/booking/:id', async(req, res)=>{
      const id = req.params.id;
      const query ={_id : new ObjectId(id)}
      const result = await bookings.deleteOne(query);
      res.send(result)
    })

    //for contact
    app.get('/feedback', async(req, res)=>{
      const result = await feedbacks.find().toArray();
      res.send(result)
    })

    app.post('/feedback', async(req, res)=>{
      const doc = req.body;
      const result = await feedbacks.insertOne(doc);
      res.send(result)
    })

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.listen(port, () => {
  console.log("Server running on", port)
})

