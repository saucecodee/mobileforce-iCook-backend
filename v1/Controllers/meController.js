const mongoose = require('mongoose')
const Jimp = require('jimp');
const multer = require('multer') 
const User = require('../../Models/authModel')
const Dish = require('../../Models/dishModel')
const uploadImage = require('../../Database/uploadImage')
const Profile = require('../../Models/profileModel')
const PublicResponse = require('../../Helpers/model')

const multerStorage = multer.memoryStorage()

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true)
  }else {
    cb(new Error('Not an image! Please upload only images', false))
  }
}

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
})

exports.uploadUserPhoto = upload.single('photo'),

exports.resizeUserPhoto = async (req, res, next) => {
  try{
    if (!req.file) return next()
  
    req.file.filename = `user-${req.user._id}-${Date.now()}.jpeg`
  
    let image = await Jimp.read(req.file.buffer);
      image.resize(256, 256)
          .quality(90)
          .write(`./public/img/users/${req.file.filename}`);
  
      next();
  }catch(err) {
    throw new Error("AM error occured! Please try again");
  }
}
// @Usman Jun 28
exports.get_me = async (req, res) => {
  try {
    const userId = req.user._id.toString()
    const me = await Profile.findOne({ userId }).select([
      '-favourites',
      '-followers',
      '-following'
    ])

    if (me) {
      res.status(200).json({
        status: 'success',
        error: '',
        data: {
          me
        }
      })
    } else {
      throw new Error('Not found')
    }
  } catch (err) {
    return res.status(404).json({
      status: 'fail',
      error: `user with ID ${req.params.id} not found`
    })
  }
}

//Get dishes posted by a user @omodauda
exports.get_user_dishes = async (req, res, next) => {
  try {
    const me = await Profile.findOne({
      userId: req.user._id
    });
    const {lastSync, size=15, after} = req.query;
    const date = lastSync ? new Date(req.query.lastSync) : new Date().setDate(new Date().getDate() - 3);
    const _dishes = await Dish.find({
      $and: [
        {
          $or: [
            {
              'chefId': {
                $in: me.following.map(id => mongoose.Types.ObjectId(id.toString())),
              }
            },
            {
              'chefId': req.user._id
            }
          ],
        },
        {
          'updatedAt': {
            $gte: date 
          }
        }
      ]
    });
    const isFavourite = id => ({ isFavourite: me.favourites.includes(id) });
    const dishes = PublicResponse.dishes(_dishes, req, isFavourite); 
    let foundIndex = 0;
    let paginated = [];

    if (after) {
      foundIndex = dishes.findIndex(d => d._id.toLocaleString() === after.toLocaleString());
      if (foundIndex >= 0) {
        const start = foundIndex + 1;
        paginated = dishes.slice(start, start + Number(size));
      }
    } else {
      paginated = dishes.slice(foundIndex, Number(size));
    }

    const last = paginated[paginated.length - 1];
    const lastToken = last ? last._id : null;

    return res.status(200).json({
      status: 'success',
      error: '',
      results: dishes.length,
      data: {
        total: dishes.length,
        count: paginated.length,
        dishes: paginated,
        after: lastToken
      }
    })
  } catch (error) {
    return res.status(404).json({
      status: 'fail',
      error: error.message
    })
  }
}

// @Usman Jun 27 - Closes #47
exports.get_auth = async (req, res) => {
  try {
    const userId = req.user._id.toString()
    const me = await User.findOne({ _id: userId })

    if (me) {
      res.status(200).json({
        status: 'success',
        error: '',
        data: {
          me
        }
      })
    } else {
      throw new Error('Not found')
    }
  } catch (err) {
    return res.status(404).json({
      status: 'fail',
      error: `user with ID ${req.params.id} not found`
    })
  }
}

// @Usman Jun 28
exports.get_favourites = async (req, res) => {
  const {size=15, after} = req.query;
  try {
    const userId = req.user._id.toString(); 
    const me = await Profile.findOne({userId});
    let favourites = await Dish.find({
      '_id': {
        $in: me.favourites.map(id => mongoose.Types.ObjectId(id.toString()))
      }
    });
    favourites = PublicResponse.dishes(favourites, req);
    let paginated = [];
    let foundIndex = 0;
    if (after) {
      foundIndex = favourites.findIndex(d => d._id.toLocaleString() === after.toLocaleString());
      if (foundIndex >= 0) {
        const start = foundIndex + 1;
        paginated = favourites.slice(start, start + Number(size));
      }
    } else {
      paginated = favourites.slice(foundIndex, Number(size));
    }

    const last = paginated[paginated.length - 1];
    const lastToken = last ? last._id : null;

    if (me) {
      res.status(200).json({
        status: 'success',
        error: '',
        data: {
          total: favourites.length,
          count: paginated.length,
          dishes: paginated,
          after: lastToken
        }
      })
    } else {
      throw new Error('Not found')
    }
  } catch (err) {
    return res.status(404).json({
      status: 'fail',
      error: `user with ID ${req.params.id} not found`
    })
  }
}

exports.get_settings = async (req, res, next) => {}

exports.update_profile = async (req, res) => {

  const { name, email, gender, phone } = req.body
  const fieldsToUpdate = {}
  if (name) fieldsToUpdate.name = name
  if (gender) fieldsToUpdate.gender = gender
  if (phone) fieldsToUpdate.phoneNumber = phone
  if (email) fieldsToUpdate.email = email
  if (req.file) fieldsToUpdate.userImage = req.file.filename;
  try {
    let userProfile = await Profile.findOne({ userId: req.user._id })

    if (!userProfile) {
      throw new Error('Profile not found')
    }

    userProfile = await Profile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: fieldsToUpdate },
      {
        new: true
      }
    )
    res.status(200).json({
      status: 'success',
      data: userProfile,
      error: {}
    })
  } catch (err) {
    res.status(500).json({
      error: err
    })
  }
}

exports.update_settings = async (req, res) => {}

exports.unlink_google = async (req, res) => {}

exports.unlink_facebook = async (req, res) => {}

exports.delete_account = async (req, res) => {}

exports.upload_photo = async (req, res) => {

}
