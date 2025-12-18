const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  signatureVersion: "v4",
  region: process.env.AWS_REGION, //process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

getSignedFileUrl = async (key, expiresIn = 300) => {
  const obj = await s3.getSignedUrlPromise("getObject", {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Expires: expiresIn, // seconds
  });
  return obj;
};

exports.uploadFile = async (filePath, bucketName, keyName) => {
  var fs = require("fs");
  // Read the file
  const file = fs.readFileSync(filePath);

  // Setting up S3 upload parameters
  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET, // Bucket into which you want to upload file
    Key: keyName, // Name by which you want to save it
    Body: file, // Local file
  };

  await s3.upload(uploadParams, function (err, data) {
    if (err) {
      console.log("Error", err);
    }
    if (data) {
      console.log("Upload Success", data.Location);
    }
  });
  return getSignedFileUrl(keyName, 3600); // Return signed URL valid for 1 hour
};

exports.listObjectsInBucket = (bucketName) => {
  // Create the parameters for calling listObjects
  var bucketParams = {
    Bucket: process.env.AWS_S3_BUCKET,
  };

  // Call S3 to obtain a list of the objects in the bucket
  s3.listObjects(bucketParams, function (err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success", data);
    }
  });
};

exports.deleteBucket = (bucketName) => {
  // Create params for S3.deleteBucket
  var bucketParams = {
    Bucket: process.env.AWS_S3_BUCKET,
  };

  // Call S3 to delete the bucket
  s3.deleteBucket(bucketParams, function (err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success", data);
    }
  });
};
