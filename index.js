const express = require("express");
const bodyParser = require("body-parser");
const pg = require("pg");

const app = express();
app.use(bodyParser.json());

const client = new pg.Client({
  host: "XXX.XXX.XXX.XXX", // server name or IP address;
  port: 5432,
  database: "XXXXXX",
  user: "XXXXX",
  password: "XXXX",
});

client.connect();

app.post("/identify", (req, res) => {
  let event = req.body;

  // final response

  var response = {
    contact: {
      primaryContatctId: null,
      emails: [],
      phoneNumbers: [],
      secondaryContactIds: [],
    },
  };

  async function contacts_details(event) {
    // I am using pqsql so created a query using pg npm package
    // list all the users where phoneNumber or email match

    let query = `Select * from contacts where phonenumber = $1 OR email = $2`;
    let values = [event.phoneNumber, event.email];
    let customer_data = await client.query(query, values);
    var customer_exist = customer_data.rows.filter((user) => user.phonenumber == event.phoneNumber || user.email == event.email);

    // checking if users present with phonenumber or email if present ok not there i will create new record

    if (customer_exist.length > 0) {
      // filter the primary contact

      let primary_contact = customer_exist.filter((user) => user.linkprecedence == "primary");

      //fill the primary contacf details in final response

      response.contact.primaryContatctId = primary_contact[0].id;
      response.contact.emails.push(primary_contact[0].email);
      response.contact.phoneNumbers.push(primary_contact[0].phonenumber);
      response.contact.secondaryContactIds.push(primary_contact[0].linkedid);

      // checking if same phonenumber and email record is there or not if it is there i will not create new secondary record

      let same_user = customer_exist.filter((user) => user.phonenumber == event.phoneNumber && user.email == event.email);
      if (same_user.length > 0) {
        // if same record present i will run loop other than primary records push the values to final response

        for (let i = 0; i < customer_exist.length; i++) {
          if (customer_exist[i].linkprecedence != "primary") {
            response.contact.primaryContatctId = customer_exist[i].id;
            response.contact.emails.push(customer_exist[i].email);
            response.contact.phoneNumbers.push(customer_exist[i].phonenumber);
            response.contact.secondaryContactIds.push(customer_exist[i].linkedid);
          }
        }
        res.json({ status: "Success", data: response });
        res.end();
        client.end();
      } else {
        // taking the primary contact id to add in secondary contact
        let linkedId;
        if (customer_exist[0].linkprecedence == "primary") {
          linkedId = linkedId[0].id;
        } else {
          linkedId = linkedId[0].linkedid;
        }
        // inserting secondary record into pgsql
        let query = `INSERT INTO contacts (phoneNumber, email, linkPrecedence,linkedId, createdAt, updatedAt, deletedAt)
            VALUES ($1, $2, $3, $4, $5, $6,$7)`;
        const values = [event.phoneNumber, event.email, "secondary", linkedId, new Date(), new Date(), null];

        await client.query(query, values);
        console.log("New secondary user created successfully");
        // taking records witch match to this phonenumber and email and push the values to final response
        let get = `SELECT * FROM contacts WHERE phonenumber = $1 OR email = $2`;
        let data = [event.phoneNumber, event.email];
        let customer_data = await client.query(get, data);
        customer_exist = customer_data.rows;

        for (let i = 0; i < customer_exist.length; i++) {
          if (customer_exist[i].linkprecedence != "primary") {
            response.contact.primaryContatctId = customer_exist[i].id;
            response.contact.emails.push(customer_exist[i].email);
            response.contact.phoneNumbers.push(customer_exist[i].phonenumber);
            response.contact.secondaryContactIds.push(customer_exist[i].linkedid);
          }
        }

        res.json({ status: "Success", status_message: "secondary user created successfully", data: response });
        res.end();
        client.end();
      }
    } else {
      // creating a new record because no records found with phonenumber or email

      let query = `INSERT INTO contacts (phoneNumber, email, linkPrecedence, createdAt, updatedAt, deletedAt)
          VALUES ($1, $2, $3, $4, $5, $6)`;
      const values = [event.phoneNumber, event.email, "primary", new Date(), new Date(), null];

      await client.query(query, values);
      console.log("New user created successfully");

      // taking record and prepare final response

      let get = `SELECT * FROM contacts WHERE phonenumber = $1 OR email = $2`;
      let data = [event.phoneNumber, event.email];
      let customer_data = await client.query(get, data);
      customer_exist = customer_data.rows;

      for (let i = 0; i < customer_exist.length; i++) {
        response.contact.primaryContatctId = customer_exist[i].id;
        response.contact.emails.push(customer_exist[i].email);
        response.contact.phoneNumbers.push(customer_exist[i].phonenumber);
        response.contact.secondaryContactIds.push(customer_exist[i].linkedid);
      }
      res.json({ status: "Success", status_message: "New user created successfully", data: response });
      res.end();
      client.end();
    }
  }
  contacts_details(event);
});

app.listen(3000, () => {
  console.log("Server running on 3000 port");
});
