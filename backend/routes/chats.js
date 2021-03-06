//express is the framework we're going to use to handle requests
const express = require('express')

//Access the connection to Heroku Database
let pool = require('../utilities/utils').pool

var router = express.Router()

//This allows parsing of the body of POST requests, that are encoded in JSON
router.use(require("body-parser").json())

/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */ 

/**
 * @api {post} /chats Request to add a chat
 * @apiName PostChats
 * @apiGroup Chats
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} name the name for the chat
 * 
 * @apiSuccess (Success 201) {boolean} success true when the name is inserted
 * @apiSuccess (Success 201) {Number} chatId the generated chatId
 * 
 * @apiError (400: Unknown user) {String} message "unknown email address"
 * 
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 * 
 * @apiError (400: Unknow Chat ID) {String} message "invalid chat id"
 * 
 * @apiUse JSONError
 */ 
router.post("/", (request, response, next) => {
    if (!request.body.name) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        next()
    }
}, (request, response) => {

    let insert = `INSERT INTO Chats(Name)
                  VALUES ($1)
                  RETURNING ChatId`
    let values = [request.body.name]
    pool.query(insert, values)
        .then(result => {
            response.send({
                success: true,
                chatID:result.rows[0].chatid
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })

        })
})


/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */ 

/**
 * @api {post} /chats Request to add a direct chat
 * @apiName PostChats
 * @apiGroup Chats
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * @apiParam {String} name the name for the chat
 * 
 * @apiSuccess (Success 201) {boolean} success true when the name is inserted
 * @apiSuccess (Success 201) {Number} chatId the generated chatId
 * 
 * @apiError (400: Unknown user) {String} message "unknown email address"
 * 
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 * 
 * @apiError (400: Unknow Chat ID) {String} message "invalid chat id"
 * @apiError (400: Email Not Found) {String} message "Email Not Found"
 * @apiError (400: Email Not Verified) {String} message "Email has not been verified"
 * @apiError (400: Contact Not Found) {String} message "Contact does not exist" 
 * 
 * @apiUse JSONError
 */ 
router.post("/direct", (request, response, next) => {
    if (!request.body.name || !request.body.email_A || !request.body.email_B) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    //validate first email exists 
    let query = 'SELECT MemberID, Verification FROM Members WHERE Email=$1'
    let values = [request.body.email_A]
    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "email not found"
                })
            } else if (result.rows[0].verification == 0) {
                response.status(404).send({
                    message: "email has not been verified"
                })
            } else {
                //user found
                request.memberId_A = result.rows[0].memberid
                next()
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response, next) => {
    //validate second email exists 
    let query = 'SELECT MemberID, Verification FROM Members WHERE Email=$1'
    let values = [request.body.email_B]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "email not found"
                })
            } else if (result.rows[0].verification == 0) {
                response.status(404).send({
                    message: "email has not been verified"
                })
            } else {
                //user found
                request.memberId_B = result.rows[0].memberid
                next()
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response, next) => {
    //validate contact does not already exist 
    let query = 'SELECT * FROM Contacts WHERE (MemberID_A=$1 AND MemberID_B=$2) OR (MemberID_B=$1 AND MemberID_A=$2)'
    let values = [request.memberId_A, request.memberId_B]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(400).send({
                    message: "contact does not exist"
                })
            } else {
                next()
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        }) 
}, (request, response, next) => {
    //Create new direct chat
    let insert = `INSERT INTO Chats(Name,Direct)
                  VALUES ($1,1)
                  RETURNING ChatId`
    let values = [request.body.name]
    pool.query(insert, values)
        .then(result => {
            request.chatid = result.rows[0].chatid
            next()
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })

        })
}, (request, response) => {
    //Insert 2 members into the chat
    let insert = `INSERT INTO ChatMembers(ChatId, MemberId)
                  VALUES ($1, $2), ($1, $3)
                  RETURNING *`
    let values = [request.chatid, request.memberId_A, request.memberId_B]
    pool.query(insert, values)
        .then(result => {
            response.send({
                success: true,
                chatID: request.chatid
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
    }
)


/**
 * @api {put} /chats/:chatId? Request add a user to a chat
 * @apiName PutChats
 * @apiGroup Chats
 * 
 * @apiDescription Adds the user associated with the required JWT. 
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * 
 * @apiParam {Number} chatId the chat to add the user to
 * @apiParam {String} email the user to be added
 * 
 * @apiSuccess {boolean} success true when the user is inserted
 * 
 * @apiError (404: Chat Not Found) {String} message "chatID not found"
 * @apiError (404: Email Not Found) {String} message "email not found"
 * @apiError (400: Invalid Parameter) {String} message "Malformed parameter. chatId must be a number"
 * @apiError (400: Illegal add member request) {String} message "Cannot add more member to a direct chat" 
 * @apiError (400: Duplicate Email) {String} message "user already joined"
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 * 
 * @apiUse JSONError
 */ 
router.put("/:chatId", (request, response, next) => {
    //validate on empty parameters
    if (!request.params.chatId || !request.query.email) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else if (isNaN(request.params.chatId)) {
        response.status(400).send({
            message: "Malformed parameter. chatId must be a number"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    //validate chat id exists
    let query = 'SELECT * FROM CHATS WHERE ChatId=$1'
    let values = [request.params.chatId]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "Chat ID not found"
                })
            } else {
                if (result.rows[0].direct == 1) {
                    response.status(400).send({
                        message: "Cannot add more member to a direct chat"
                    }) 
                } else {
                    next()
                }   
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
        //code here based on the results of the query
}, (request, response, next) => {
    //validate email exists 
    let query = 'SELECT * FROM Members WHERE Email=$1'
    let values = [request.query.email]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "email not found"
                })
            } else {
                //user found
                request.decoded.memberid = result.rows[0].memberid
                next()
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response, next) => {
        //validate email does not already exist in the chat
        let query = 'SELECT * FROM ChatMembers WHERE ChatId=$1 AND MemberId=$2'
        let values = [request.params.chatId, request.decoded.memberid]
    
        pool.query(query, values)
            .then(result => {
                if (result.rowCount > 0) {
                    response.status(400).send({
                        message: "user already joined"
                    })
                } else {
                    next()
                }
            }).catch(error => {
                response.status(400).send({
                    message: "SQL Error",
                    error: error
                })
            })

}, (request, response) => {
    //Insert the memberId into the chat
    let insert = `INSERT INTO ChatMembers(ChatId, MemberId)
                  VALUES ($1, $2)
                  RETURNING *`
    let values = [request.params.chatId, request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            response.send({
                success: true
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
    }
)

/**
 * @api {get} /chats/:chatId? Request to get the emails of user in a chat
 * @apiName GetChats
 * @apiGroup Chats
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * 
 * @apiParam {Number} chatId the chat to look up. 
 * 
 * @apiSuccess {Number} rowCount the number of messages returned
 * @apiSuccess {Object[]} rows List of members in the chat
 * 
 * @apiError (404: ChatId Not Found) {String} message "Chat ID Not Found"
 * @apiError (400: Invalid Parameter) {String} message "Malformed parameter. chatId must be a number" 
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 * 
 * @apiUse JSONError
 */ 
router.get("/:chatId", (request, response, next) => {
    //validate on missing or invalid (type) parameters
    if (!request.params.chatId) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else if (isNaN(request.params.chatId)) {
        response.status(400).send({
            message: "Malformed parameter. chatId must be a number"
        })
    } else {
        next()
    }
},  (request, response, next) => {
    //validate chat id exists
    let query = 'SELECT * FROM CHATS WHERE ChatId=$1'
    let values = [request.params.chatId]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "Chat ID not found"
                })
            } else {
                next()
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
    }, (request, response) => {
        //REtrive the members
        let query = `SELECT Members.Email 
                    FROM ChatMembers
                    INNER JOIN Members ON ChatMembers.MemberId=Members.MemberId
                    WHERE ChatId=$1`
        let values = [request.params.chatId]
        pool.query(query, values)
            .then(result => {
                response.send({
                    rowCount : result.rowCount,
                    rows: result.rows
                })
            }).catch(err => {
                response.status(400).send({
                    message: "SQL Error",
                    error: err
                })
            })
});


/**
 * @api {get} /chats/getchatid/:chatId? Request to get the chat IDs of an email
 * @apiName GetChats
 * @apiGroup Chats
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * 
 * @apiParam {Number} email the email to look up. 
 * 
 * @apiSuccess {Number} rowCount the number of chat IDs returned
 * @apiSuccess {Object[]} members List of chat IDs where the email is a member of those chats
 * @apiSuccess {String} messages.chatID The chat IDs for the chats having the email
 * 
 * @apiError (400: Email Not Found) {String} message "Email Not Found"
 * @apiError (400: Email Not Verified) {String} message "Email has not been verified"
 * @apiError (400: No Contacts Found) {String} message "User has no chats" 
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 * 
 * @apiUse JSONError
 */ 
router.get("/getchatid/:email?", (request, response, next) => {
    if (!request.params.email) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else {
        request.params.email = (request.params.email).toLowerCase()
        next()
    }
}, (request, response, next) => {
        //validate email exists 
        let query = 'SELECT MemberID, Verification FROM Members WHERE Email=$1'
        let values = [request.params.email]
        pool.query(query, values)
            .then(result => {
                if (result.rowCount == 0) {
                    response.status(400).send({
                        message: "email not found"
                    })
                } else if (result.rows[0].verification == 0) {
                    response.status(400).send({
                        message: "email has not been verified"
                    })
                } else {
                    //user found
                    request.memberid = result.rows[0].memberid
                    next()
                }
            }).catch(error => {
                response.status(400).send({
                    message: "SQL Error",
                    error: error
                })
            })
    }, (request, response) => {
        let query = `SELECT Chats.name, Chats.direct, ChatMembers.chatid, coalesce(Messages.message, '') AS message, coalesce(to_char(Messages.timestamp AT TIME ZONE 'PDT', 'YYYY-MM-DD HH24:MI:SS.US' ), '') AS Timestamp
        FROM ChatMembers
        LEFT JOIN Chats ON ChatMembers.chatid = Chats.chatid
        LEFT JOIN Messages ON ChatMembers.chatid = Messages.chatid
        WHERE ChatMembers.Memberid=$1
        AND (Timestamp=(SELECT MAX(Timestamp) FROM Messages WHERE ChatMembers.chatid = Messages.chatid) 
        OR Timestamp IS NULL)`
        let values = [request.memberid]
    
        pool.query(query, values)
            .then(result => {
                response.send({
                    chatCount : result.rowCount,
                    chats: result.rows
                })
            }).catch(error => {
                response.status(400).send({
                    message: "SQL Error",
                    error: error
                })
            })
    })


/**
 * @api {delete} /chats/:chatId?/:email? Request delete a user from a chat
 * @apiName DeleteChats
 * @apiGroup Chats
 * 
 * @apiDescription Does not delete the user associated with the required JWT but 
 * instead delelets the user based on the email parameter.  
 * 
 * @apiParam {Number} chatId the chat to delete the user from
 * @apiParam {String} email the email of the user to delete
 * 
 * @apiSuccess {boolean} success true when the name is deleted
 * 
 * @apiError (404: Chat Not Found) {String} message "chatID not found"
 * @apiError (400: Illegal add member request) {String} message "Cannot delete a member from a direct chat"
 * @apiError (404: Email Not Found) {String} message "email not found"
 * @apiError (400: Invalid Parameter) {String} message "Malformed parameter. chatId must be a number" 
 * @apiError (400: Duplicate Email) {String} message "user not in chat"
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 * 
 * @apiUse JSONError
 */ 
router.delete("/:chatId/:email", (request, response, next) => {
    //validate on empty parameters
    if (!request.params.chatId || !request.params.email) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else if (isNaN(request.params.chatId)) {
        response.status(400).send({
            message: "Malformed parameter. chatId must be a number"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    //validate chat id exists
    let query = 'SELECT * FROM CHATS WHERE ChatId=$1'
    let values = [request.params.chatId]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "Chat ID not found"
                })
            } else {
                if (result.rows[0].direct == 1) {
                    response.status(400).send({
                        message: "Cannot delete a member from a direct chat"
                    }) 
                } else {
                    next()
                }   
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response, next) => {
    //validate email exists AND convert it to the associated memberId
    let query = 'SELECT MemberID FROM Members WHERE Email=$1'
    let values = [request.params.email]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "email not found"
                })
            } else {
                request.params.email = result.rows[0].memberid
                next()
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response, next) => {
        //validate email exists in the chat
        let query = 'SELECT * FROM ChatMembers WHERE ChatId=$1 AND MemberId=$2'
        let values = [request.params.chatId, request.params.email]
    
        pool.query(query, values)
            .then(result => {
                if (result.rowCount > 0) {
                    next()
                } else {
                    response.status(400).send({
                        message: "user not in chat"
                    })
                }
            }).catch(error => {
                response.status(400).send({
                    message: "SQL Error",
                    error: error
                })
            })

}, (request, response) => {
    //Delete the memberId from the chat
    let insert = `DELETE FROM ChatMembers
                  WHERE ChatId=$1
                  AND MemberId=$2
                  RETURNING *`
    let values = [request.params.chatId, request.params.email]
    pool.query(insert, values)
        .then(result => {
            response.send({
                success: true
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
    }
)


/**
 * @api {delete} /chats/:chatId?/ Request delete a chat
 * @apiName DeleteChats
 * @apiGroup Chats
 * 
 * @apiDescription Does not delete the user associated with the required JWT but 
 * instead delelets the user based on the email parameter.  
 * 
 * @apiParam {Number} chatId the chat to delete the user from
 * 
 * @apiSuccess {boolean} success true when the chat is deleted
 * 
 * @apiError (404: Chat Not Found) {String} message "chatID not found"
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 * 
 * @apiUse JSONError
 */ 
router.delete("/:chatId/", (request, response, next) => {
    //validate on empty parameters
    if (!request.params.chatId) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else if (isNaN(request.params.chatId)) {
        response.status(400).send({
            message: "Malformed parameter. chatId must be a number"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    //validate chat id exists
    let query = 'SELECT * FROM CHATS WHERE ChatId=$1'
    let values = [request.params.chatId]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "Chat ID not found"
                })
            } else {
                next() 
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response, next) => {
    //Delete chat messages
    let insert = `DELETE FROM Messages WHERE chatid=$1`
    let values = [request.params.chatId]
    pool.query(insert, values)
        .then(result => {
            next()
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
}, (request, response, next) => {
    //Delete chat members
    let insert = `DELETE FROM ChatMembers WHERE chatid=$1`
    let values = [request.params.chatId]
    pool.query(insert, values)
        .then(result => {
            next()
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
}, (request, response) => {
    //Delete chat members
    let insert = `DELETE FROM Chats WHERE chatid=$1`
    let values = [request.params.chatId]
    pool.query(insert, values)
        .then(result => {
            response.send({
                success: true
            })
        }).catch(err => {
            response.status(400).send({
                message: "SQL Error",
                error: err
            })
        })
    }
)

module.exports = router