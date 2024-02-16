const express = require('express');
const cors = require('cors');
const jwt  = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

const port = process.env.PORT || 5000;
const app = express();

// Middlewere
app.use(cors());
app.use(express.json());

app.get('/', (req, res)=>{
    res.send('MHR Boss Restaurant Server Side running')
})





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.3cndw30.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// Deploy the server side and remove the function use only testing conent the mongodb
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

// Connect the client to the server
const usersCollection = client.db('mrhBossDB').collection('users');
const menuCollection = client.db('mrhBossDB').collection('menu');
const reviewsCollection = client.db('mrhBossDB').collection('reviews');
const reviewItemsCollection = client.db('mrhBossDB').collection('reviewItems');
const cartsCollection = client.db('mrhBossDB').collection('carts');
const bookingCollection = client.db('mrhBossDB').collection('booking');
const paymentCollection = client.db("mrhBossDB").collection("payments");


// jwt related api

app.post('/jwt', async(req, res)=>{
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '5h'})
    res.send({ token })
})

//jwt  Middlewere

const verifyToken = (req, res, next)=>{
    // console.log(req.headers?.authorization);
    if(!req.headers.authorization){
        return res.status(401).send({message: 'forbidden access'})
    }
    const token = req.headers.authorization.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode)=>{
        if(err){
            return res.status(401).send({message: 'forbidden access'})
        }
        req.decode = decode
        next()
    })
}

// user verify admin after verifyToken
const verifyAdmin = async(req, res, next)=>{
    const email = req.decode.email;
    const query = {email: email}
    const user = await usersCollection.findOne(query);
    const isAdmin = user?.role === 'admin';
    if(!isAdmin){
        return res.status(403).send({message: 'forbidden'})
    }
    next()
}


// users related api
app.get('/users',verifyToken,verifyAdmin, async(req, res)=>{
    const result = await usersCollection.find().toArray();
    const verifiedUser = result?.filter(user => user.emailVerified === true)
    res.send(verifiedUser)
})

app.get('/users-stats',verifyToken, verifyAdmin, async(req, res)=>{
    const query = {email: req.query.email}
    const menu = await menuCollection.estimatedDocumentCount()
    const reviews = await reviewsCollection.countDocuments(query)
    const payment = await paymentCollection.countDocuments(query)
    const orders = await cartsCollection.countDocuments(query)
    const booking = await bookingCollection.countDocuments(query)
    res.send({menu,  orders,reviews, booking, payment } || [])

} )

app.get('/users/admin/:email', verifyToken, async(req, res)=>{
    const email = req.params.email;
    if(email !== req.decode.email){
        return res.status(403).send({message: 'unauthorized access'})
    }

    const query = { email: email}
    const user = await usersCollection.findOne(query)
    let admin = false
    if(user){
        admin = user?.role === 'admin'
    }
    res.send({admin})
})

app.post('/users', async(req, res)=>{
    const user = req.body;
    const query = {email: user.email}
    const existingUser = await usersCollection.findOne(query);
    if(existingUser){
        return {message: 'user already exists'}
    }
    const result = await usersCollection.insertOne(user);
    res.send(result)
})

app.put('/users', async(req, res)=>{
    const query = {email: req.query.email}
    const userInfo = req.body;
    const options = { upsert: true };
    const updateEmail ={
        $set:{
            ...userInfo
        }
    };
    const result = await usersCollection.updateOne(query,updateEmail, options)
    res.send(result)
})

app.patch('/users/admin/:id',verifyToken, verifyAdmin, async(req, res)=>{
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)}
    const setUserAdmin ={
        $set: {
            role: 'admin'
        }
    }
    const result = await usersCollection.updateOne(filter, setUserAdmin)
    res.send(result)
})


app.delete('/users/:id',verifyToken, verifyAdmin, async(req, res)=>{
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)}
    const result = await usersCollection.deleteOne(filter);
    res.send(result)
})




//  menu related api
app.get('/menu', async(req, res)=>{
    const cursor = menuCollection.find()
    const result = await cursor.toArray()
    res.send(result || [])
})

app.get('/menu/:id',verifyToken, verifyAdmin, async(req, res)=>{
    const id = req.params.id
    const filter = {_id: new ObjectId(id)};
    const result = await menuCollection.findOne(filter)
    res.send(result)
})

app.get('/relatedItemsMenu/:category', async(req, res)=>{
    const category = req.params.category
    const query = {category: category }
    const result = await menuCollection.find(query).toArray()
    res.send(result || [])
})


app.post('/menu',verifyToken, verifyAdmin, async(req, res)=>{
    const menuInfo = req.body;
    const result = await menuCollection.insertOne(menuInfo)
    res.send(result)
})


app.put('/menu/:id', verifyToken, verifyAdmin, async(req, res)=>{
    const id = req.params.id;
    const menuItem = req.body
    const filter = {_id: new ObjectId(id)}
    const options = { upsert: true };
    const updateMenuItem = {
        $set:{
            ...menuItem
        }
    }

    const result = await menuCollection.updateOne(filter,updateMenuItem,options)
    res.send(result)
})



app.patch('/menu/:id', async (req, res) => {
    const item = req.body;
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) }
    const updatedDoc = {
      $set: {
        name: item.name,
        category: item.category,
        price: item.price,
        recipe: item.recipe,
        image: item.image
      }
    }

    const result = await menuCollection.updateOne(filter, updatedDoc)
    res.send(result);
  })


app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) }
    const result = await menuCollection.deleteOne(query);
    res.send(result);
  })

app.get('/admin-stats',verifyToken, verifyAdmin, async(req, res)=>{
    const users = await usersCollection.estimatedDocumentCount();
    const menuItems = await menuCollection.estimatedDocumentCount();
    const orders = await paymentCollection.estimatedDocumentCount();

    // const result = await paymentCollection.aggregate([
    //     {
    //         $group:{
    //             _id: null,
    //             totalRevenus:{
    //                 $sum: '$price'
    //             }
    //         }
    //     }
    // ]).toArray()

    const result = await paymentCollection.find().toArray()
    const revenue = result.reduce((totalPrices, items) => totalPrices + Number(items.price),0)


    res.send({
        users,
        menuItems,
        orders,
        revenue

    })
})

// reviews related api
app.get('/reviews', async(req, res)=>{
    const query = {email: req.query.email}
    const result = await reviewsCollection.find(query).toArray()
    res.send(result || [])
})

app.post('/reviews', verifyToken, async(req, res)=>{
    const reviewInfo = req.body
    const result = await reviewsCollection.insertOne(reviewInfo)
    res.send(result)
})

app.get('/reviewItems/:id', async(req, res)=>{
    const id = req.params.id;
    const filter = {itemId : id}
    const result = await reviewItemsCollection.find(filter).toArray()
    res.send(result)
})

app.post('/reviewItems', async(req, res)=>{
    const reviewInfo = req.body
    const result = await reviewItemsCollection.insertOne(reviewInfo)
    res.send(result)
})


// carts related api
app.post('/carts', async(req, res)=>{
    const card = req.body
    const result = await cartsCollection.insertOne(card);
    res.send(result)
});

app.get('/carts', async(req, res)=>{
    const email = req.query.email
    const query = {email: email};
    const result = await cartsCollection.find(query).toArray();
    res.send(result )
})

app.delete('/carts/:id', async(req, res)=>{
    const id = req.params.id
    const filter = {_id: new ObjectId(id)};
    const result = await cartsCollection.deleteOne(filter)
    res.send(result)
})

// payment intent
app.post('/create-payment-intent',verifyToken, async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
    });
    res.send({
        clientSecret: paymentIntent.client_secret
    })
});

app.get('/payments',verifyToken, async(req, res)=>{
    let query = {email: req.query.email}

    const result = await paymentCollection.find(query).toArray();
    res.send(result);

})


app.post('/payments',verifyToken, async(req, res)=>{
    const payment = req.body;
    const paymentResult = await paymentCollection.insertOne(payment);

    const query ={
        _id: {
            $in: payment.cartIds.map(id => new ObjectId(id))
        }
    }
    const deleteResult = await cartsCollection.deleteMany(query)

    res.send({paymentResult, deleteResult})
})
//bookings raleted api
app.get('/payments-bookings', verifyToken,verifyAdmin, async(req, res)=>{
    const result = await paymentCollection.find().toArray()
    res.send(result)
})
// const filter = {_id: new ObjectId(id)}
// const setUserAdmin ={
//     $set: {
//         role: 'admin'
//     }
// }
// const result = await usersCollection.updateOne(filter, setUserAdmin)
app.patch('/payments-bookings', verifyToken, verifyAdmin, async(req, res)=>{
    const id = req.query.id
    const filter = {_id: new ObjectId(id)}
    const updatedStatus ={
        $set: {
            status: 'active'
        }
    }
    const result = await paymentCollection.updateOne(filter, updatedStatus)
    res.send(result)

})
// using aggregate pipeline
// app.get('/order-stats',  async(req, res) =>{
//
//     const payment = await paymentCollection.aggregate([
//         {
//             $unwind: '$menuItemIds'
//         },
//         {
//         $lookup: {
//             from: 'menu',
//             localField: 'menuItemIds',
//             foreignField: '_id',
//             as: 'menuIds'
//         }
//         },
//
//     ]).toArray()
//     res.send({payment})
//
// })


// using aggregate pipeline
    app.get('/order-stats',  async(req, res) =>{
        const result = await paymentCollection.aggregate([
          {
            $unwind: '$menuItemIds'
        //   },
        //   {
        //     $lookup: {
        //       from: 'menu',
        //       localField: 'menuItemIds',
        //       foreignField: '_id',
        //       as: 'cartIds'
        //     }
        //   },
        //   {
        //     $unwind: '$cartIds'
        //   },
        //   {
        //     $group: {
        //       _id: '$cartIds.category',
        //       quantity:{ $sum: 1 },
        //       revenue: { $sum: '$cartIds.price'}
        //     }
        //   },
        //   {
        //     $project: {
        //       _id: 0,
        //       category: '$_id',
        //       quantity: '$quantity',
        //       revenue: '$revenue'
        //     }
          },

        ]).toArray();


        res.send(result);

      })

//           {
//             $group: {
//               _id: '$menuItems.category',
//               quantity:{ $sum: 1 },
//               revenue: { $sum: '$menuItems.price'}
//             }
//           },
//           {
//             $project: {
//               _id: 0,
//               category: '$_id',
//               quantity: '$quantity',
//               revenue: '$revenue'
//             }
//           }


//     // using aggregate pipeline
//     app.get('/order-stats', verifyToken, verifyAdmin, async(req, res) =>{
//         const result = await paymentCollection.aggregate([
//           {
//             $unwind: '$menuItemIds'
//           },
//           {
//             $lookup: {
//               from: 'menu',
//               localField: 'menuItemIds',
//               foreignField: '_id',
//               as: 'menuItems'
//             }
//           },
//           {
//             $unwind: '$menuItems'
//           },
//           {
//             $group: {
//               _id: '$menuItems.category',
//               quantity:{ $sum: 1 },
//               revenue: { $sum: '$menuItems.price'}
//             }
//           },
//           {
//             $project: {
//               _id: 0,
//               category: '$_id',
//               quantity: '$quantity',
//               revenue: '$revenue'
//             }
//           }
//         ]).toArray();
//
//         res.send(result);
//
//       })
//
//       // Send a ping to confirm a successful connection
//       // await client.db("admin").command({ ping: 1 });
//       // console.log("Pinged your deployment. You successfully connected to MongoDB!");
//     } finally {
//       // Ensures that the client will close when you finish/error
//       // await client.close();
//     }
//   }
//   run().catch(console.dir);
//
//
//   app.get('/', (req, res) => {
//     res.send('boss is sitting')
//   })
//
//   app.listen(port, () => {
//     console.log(`Bistro boss is sitting on port ${port}`);
//   })


// app.get('/payments/:email', async (req, res) => {
//     const query = { email: req.params.email }
//     // if (req.params.email !== req.decoded.email) {
//     //   return res.status(403).send({ message: 'forbidden access' });
//     // }
//     const result = await paymentCollection.find(query).toArray();
//     res.send(result);
//   })

//   app.post('/payments', async (req, res) => {
//     const payment = req.body;
//     const paymentResult = await paymentCollection.insertOne(payment);
//
//     // carefully delete each item from the cart
//     // console.log('payment info', payment);
//     const query = {
//       _id: {
//         $in: payment.cartIds.map(id => new ObjectId(id))
//       }
//     };
//
//     const deleteResult = await cartsCollection.deleteMany(query);
//
//     res.send({ paymentResult, deleteResult });
//   })


app.listen(port, ()=>{
    console.log('MHR Boss Restaurant Server Side Port number', port);
})