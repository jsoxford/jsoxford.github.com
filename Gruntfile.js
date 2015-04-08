var jpegRecompress = require('imagemin-jpeg-recompress');

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    less: {
      build: {
        options: {
          paths: ["css"]
        },
        files: {
          "css/style.css": "css/style.less"
        }
      }
    },
    jekyll: {
      options: {
        bundleExec: true
      },
      build: {
        options: {
          config: '_config.yml',
          serve: false
        }
      },
      serve: {
        options: {
          config: '_config.yml',
          serve: true,
          port: 5000,
          nowatch: true
        }
      },
    },
    imagemin: {
      static: {
        options: {
          optimizationLevel: 7,
          use: [jpegRecompress()]
        },
        files: [{
          expand: true,
          cwd: '_site/img',
          src: '*',
          dest: '_site/img'
        }]
      }
    },
    uncss: {
      dist: {
        options: {
          stylesheets: ['_site/css/style.css'],
          ignore: [
            '.post',
            '.post-title',
            /.eventInfo.*/,
            /#MeetupMembers.*/,
            /.collapse.*/,
            /.in.*/,
      	    /col-xs-3.*/,
      	    /col-xs-9.*/,
            /icon-thumb_.*/
          ]
        },
        files: {
          '_site/css/style.css': ['*.html','**/*.html', '!node_modules/**/*.html']
        }
      },
    },
    cssmin: {
      dist: {
        files: {
          '_site/css/style.css': ['_site/css/style.css','_site/css/sprites.css']
        }
      }
    },
    htmlmin: {
      dist: {
        options: {
          collapseWhitespace: true,
          removeComments: true,
          removeEmptyAttributes: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          minifyJS: true,
          minifyCSS: true
        },
        files: [
        {
          expand: true,
          cwd: '_site/',
          src: ['*.html','**/*.html'],
          dest: '_site/'
        }
        ]
      }
    },
    uglify: {
      dist: {
        options: {
          sourceMap: true
        },
        files: {
          '_site/js/script.js': ['_site/js/script.js']
        }
      }
    },
    buildcontrol: {
      dist: {
        options: {
          config: {'user.name': 'Travis CI', "user.email": "ryanbrooksis+ci@gmail.com"},
          login: process.env.GH_LOGIN,
          token: process.env.GH_TOKEN,
          dir: '_site',
          remote: 'https://github.com/jsoxford/jsoxford.github.com',
          branch: 'master',
          commit: true,
          push: true
        }
      }
    },
    sprite:{
      all: {
        src: 'members/*',
        dest: 'img/memberssprites.png',
        destCss: 'css/sprites.css'
      }
    },
    clean: {
      members: {
        src: ["./members", './sprites']
      }
    },
  });


  grunt.task.registerTask('downloadmemberphotos', 'Downloads all member photos from Meetup.com', function() {
    var done = this.async();
    var completed = 0;
    var membersQuery = "https://api.meetup.com/2/members?offset=0&format=json&group_id=17778422&only=photo%2Cname%2Clink&photo-host=secure&page=200&order=name&sig_id=153356042&sig=4d8e3265b4374b84aabb8efcc26eb8107a3ec81b";
    var https = require('https');
    var http = require('http');
    var fs = require('fs');
    var imageType = require('image-type');
    var lwip = require('lwip');

    // Create output dir
    if (!fs.existsSync('./members')){
        fs.mkdirSync('./members');
    }

    https.get(membersQuery, function(res) {
      var body = '';
      res.on('data', function(d) {
        body += d;
      });
      res.on('end', function() {
        var members = JSON.parse(body).results;
        for(i=0;i<members.length;i++){
          if(members[i].photo){

            (function(memberPhoto){
              var filename = "members" + memberPhoto.substring(memberPhoto.lastIndexOf('/'));
              var file = fs.createWriteStream(filename);
              var imageBytes;
              http.get(memberPhoto, function(response) {
                var ext = 'jpg';
                // Meetup.com sends all images with .jpeg extension but the file type could be anything. Lets fix that!
                response.on('data', function(chunk){
                  if(imageType(chunk) && imageType(chunk).ext){
                    ext = imageType(chunk).ext;
                  }
                });
                response.on('end', function(){
                  var newfilename = filename.replace('jpeg', ext);
                  fs.rename(filename, newfilename, function(){
                    // Resize all images to 30x30. The "!" overrides the aspect ratio.
                    lwip.open(newfilename, function(err, image){
                      image.batch()
                        .resize(30,30)
                        .writeFile(newfilename, function(err){
                          if(err) grunt.log.writeln(err);
                          if(++completed === members.length) done();
                        });

                    });
                  });
                });
                response.pipe(file);
              });

            }(members[i].photo.thumb_link));

          }else{
            if(++completed === members.length) done();
          }
        }
      });
    }).on('error', function(e) {
      grunt.log.writeln("Got error: " + e.message);
    });
  });

  grunt.registerTask('build', ['less', 'sprite-members','jekyll:build']);
  grunt.registerTask('sprite-members', ['downloadmemberphotos','sprite', 'clean:members'])
  grunt.registerTask('optimize', ['cssmin','uncss','imagemin','uglify','htmlmin']);
  grunt.registerTask('deploy', ['build','optimize','buildcontrol']);
  grunt.registerTask('default', ['build','jekyll:serve']);

};
