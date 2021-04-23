// This function is the webhook's request handler.
exports = async function (payload) {
  // Data can be extracted from the request as follows:

  // Raw request body (if the client sent one).
  // This is a binary object that can be accessed as a string using .text()
  const { email, name } = await JSON.parse(await payload.body.text());

  try {
    let jobTitle = "DevHub CMS Production Deploy";
    let jobUserName = name;
    let jobUserEmail = email;
    const newPayload = {
      jobType: "productionDeploy",
      source: "strapi",
      action: "push",
      repoName: "devhub-content",
      branchName: "master",
      isFork: true,
      private: true,
      isXlarge: true,
      repoOwner: "10gen",
      url: "https://github.com/10gen/devhub-content",
      newHead: null,
    };

    context.functions.execute(
      "addJobToQueue",
      newPayload,
      jobTitle,
      jobUserName,
      jobUserEmail
    );
  } catch (err) {
    console.log(err);
  }
};
