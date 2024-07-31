const { Router } = require('express');
const router = Router();
const ShortUrl = require('../models/ShortUrl');
const { checkUser, requireAuth } = require('../middleware/authMiddleware');
const QRCode = require('qrcode');
const shortId = require('shortid');

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;  
    }
}

// ... get shortened urls

router.get('/shorten', async (req, res) => {
    try {
        const shortUrls = await ShortUrl.find();
        res.render('shorten', { shortUrls });  // Render the 'shorten' template with shortUrls data
    } catch (error) {
        //console.error('Error retrieving short URLs:', error);
        res.status(500).render('error', { message: 'Error retrieving short URLs' });  // Render an error page
    }
});

// ... shorten url

router.post('/shorten', requireAuth, checkUser, async (req, res) => {
    if (!res.locals.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    // ... check if url is a valid url
    const { fullUrl } = req.body;
    if (!isValidUrl(fullUrl)) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    // ... check if the url already exists in the db
    try {
        const existingUrl = await ShortUrl.findOne({ full: fullUrl, user: res.locals.user._id });
        if (existingUrl) {
            return res.status(200).json({ 
                shortUrl: existingUrl, 
                alreadyExists: true 
            });
        }

        const shortCode = shortId.generate();
        const shortUrl = new ShortUrl({ 
            full: fullUrl, 
            user: res.locals.user._id,
            short: shortCode
        });

        // ... generate qrcode after url is shortened successfully
        const qrCodeDataUrl = await QRCode.toDataURL(`${req.protocol}://${req.get('host')}/${shortCode}`);
        shortUrl.qrCode = qrCodeDataUrl;

        await shortUrl.save();
        res.status(201).json({ shortUrl });
    } catch (error) {
        console.error('Error creating short URL:', error);
        res.status(500).json({ error: 'Error creating short URL' });
    }
});

// ... get url by Id
router.get('/:shortUrl', async (req, res) => {
    try {
        const shortUrl = await ShortUrl.findOne({ short: req.params.shortUrl });
        if (shortUrl == null) return res.sendStatus(404);

        shortUrl.clicks++;
        await shortUrl.save();

        res.redirect(shortUrl.full);
    } catch (error) {
        console.error('Error redirecting:', error);
        res.status(500).send('Error redirecting to full URL');
    }
});


// ... Delete a url
router.delete('/shorten/:id', requireAuth, checkUser, async (req, res) => {
    try {
        const shortUrl = await ShortUrl.findOne({ _id: req.params.id, user: res.locals.user._id });
        if (!shortUrl) {
            return res.status(404).json({ message: 'Short URL not found' });
        }
        await ShortUrl.deleteOne({ _id: req.params.id });
        res.status(200).json({ message: 'Short URL deleted successfully' });
    } catch (error) {
        console.error('Error deleting short URL:', error);
        res.status(500).json({ message: 'Error deleting short URL' });
    }
});


module.exports = router;